import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Settlement — the cross-check that decides whether money is honoured.
 *
 * No network and no database. `enquiry.js` and `db.js` are both mocked, so
 * these tests can never reach https://merchant-api.sabpaisa.in — a hard
 * requirement: automated runs must not initiate real transactions.
 *
 * The scenarios here are the ones that cost money if they regress:
 * an amount that does not match, a currency that does not match, a reference
 * that does not match, and an enquiry that cannot be reached at all.
 */

import type { settleSabPaisaPayment as SettleFn } from './settle.js';

const enquireTransaction = vi.fn();

vi.mock('./enquiry.js', () => ({
  enquireTransaction: () => enquireTransaction() as unknown,
}));

/** Captures what settlement wrote, so assertions can inspect it. */
interface Update {
  readonly table: string;
  readonly values: Record<string, unknown>;
}

let updates: Update[] = [];
let paymentRow: Record<string, unknown> | null = null;

/**
 * A chainable Supabase double.
 *
 * Every filter method returns `this`, so the production code's call chains work
 * unchanged, and the terminal methods resolve with the fixture.
 */
const makeQuery = (table: string) => {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    not: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: paymentRow, error: null }),
    update: (values: Record<string, unknown>) => {
      updates.push({ table, values });

      return chain;
    },
    insert: () => chain,
    then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
  };

  return chain;
};

vi.mock('../db.js', () => ({
  db: () => ({ from: (table: string) => makeQuery(table) }),
}));

const SECRET = 'test-secret-key-not-a-real-credential';

const MERCHANT_TXN_ID = 'YVSP-ABC123-DEADBEEF01';

/** ₹1,499.00 — the expected amount, in paise, as the local record holds it. */
const EXPECTED_PAISE = 149_900;

const localRecord = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  merchant_txn_id: MERCHANT_TXN_ID,
  order_ref: 'YV-ABCDE-12345678',
  expected_amount_paise: EXPECTED_PAISE,
  currency: 'INR',
  status: 'redirected',
  ...overrides,
});

/** An enquiry response in which everything agrees with the local record. */
const agreeingEnquiry = (overrides: Record<string, unknown> = {}) => ({
  kind: 'answered' as const,
  status: 'SUCCESS',
  merchantTxnId: MERCHANT_TXN_ID,
  amountPaise: EXPECTED_PAISE,
  currency: 'INR',
  spTxnId: 'SP1234567890',
  paymentMode: 'UPI',
  clientCode: 'TESTCC',
  ...overrides,
});

const statusOf = (table: string): unknown =>
  updates.filter((entry) => entry.table === table).at(-1)?.values.status;

let settleSabPaisaPayment: typeof SettleFn;

beforeEach(async () => {
  process.env.SABPAISA_CLIENT_CODE = 'TESTCC';
  process.env.SABPAISA_MERCHANT_ID = 'TESTMI';
  process.env.SABPAISA_API_KEY = 'test-api-key';
  process.env.SABPAISA_SECRET_KEY = SECRET;
  process.env.SABPAISA_BASE_URL = 'https://merchant-api.sabpaisa.in';
  process.env.PUBLIC_SITE_ORIGIN = 'https://www.yarnvia.online';

  const { resetSabPaisaEnvCache } = await import('./env.js');

  resetSabPaisaEnvCache();

  updates = [];
  paymentRow = localRecord();
  enquireTransaction.mockReset();

  ({ settleSabPaisaPayment } = await import('./settle.js'));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('a fully agreeing SUCCESS', () => {
  it('marks the payment paid and the order paid', async () => {
    enquireTransaction.mockResolvedValue(agreeingEnquiry());

    const result = await settleSabPaisaPayment(MERCHANT_TXN_ID);

    expect(result.outcome).toBe('paid');
    expect(statusOf('sabpaisa_payments')).toBe('paid');

    const order = updates.find((entry) => entry.table === 'orders');

    expect(order?.values.payment_status).toBe('paid');
  });

  it('persists SabPaisa transaction id only after verification succeeded', async () => {
    enquireTransaction.mockResolvedValue(agreeingEnquiry());

    await settleSabPaisaPayment(MERCHANT_TXN_ID);

    const written = updates.find((entry) => entry.table === 'sabpaisa_payments')?.values;

    expect(written?.sp_txn_id).toBe('SP1234567890');
    expect(written?.verified_at).toBeTypeOf('string');
  });
});

describe('SUCCESS that fails the cross-check (must never be marked paid)', () => {
  it('refuses a mismatched amount — the 100x rupees/paise bug', async () => {
    // SabPaisa reports 100 paise (₹1.00) for an order we priced at ₹1,499.00.
    enquireTransaction.mockResolvedValue(agreeingEnquiry({ amountPaise: 100 }));

    const result = await settleSabPaisaPayment(MERCHANT_TXN_ID);

    expect(result.outcome).toBe('requires_review');
    expect(statusOf('sabpaisa_payments')).toBe('requires_review');
    // The order must NOT have been marked paid.
    expect(updates.some((entry) => entry.table === 'orders')).toBe(false);
  });

  it('refuses an unreadable amount rather than assuming it matched', async () => {
    enquireTransaction.mockResolvedValue(agreeingEnquiry({ amountPaise: null }));

    expect((await settleSabPaisaPayment(MERCHANT_TXN_ID)).outcome).toBe('requires_review');
  });

  it('refuses a mismatched currency', async () => {
    enquireTransaction.mockResolvedValue(agreeingEnquiry({ currency: 'USD' }));

    expect((await settleSabPaisaPayment(MERCHANT_TXN_ID)).outcome).toBe('requires_review');
  });

  it('refuses a mismatched merchant reference', async () => {
    enquireTransaction.mockResolvedValue(agreeingEnquiry({ merchantTxnId: 'YVSP-SOMEONE-ELSE01' }));

    expect((await settleSabPaisaPayment(MERCHANT_TXN_ID)).outcome).toBe('requires_review');
  });

  it('refuses a response answered for a different merchant identity', async () => {
    enquireTransaction.mockResolvedValue(agreeingEnquiry({ clientCode: 'SOMEONEELSE' }));

    expect((await settleSabPaisaPayment(MERCHANT_TXN_ID)).outcome).toBe('requires_review');
  });

  it('flags a signed return whose paid amount contradicts the expected amount', async () => {
    enquireTransaction.mockResolvedValue(agreeingEnquiry());

    const result = await settleSabPaisaPayment(MERCHANT_TXN_ID, {
      status: 'SUCCESS',
      // ₹1.00 in paise, against an expected ₹1,499.00.
      paidAmountPaise: 100,
    });

    expect(result.outcome).toBe('requires_review');
  });
});

describe('an unreachable enquiry must never become success or failure', () => {
  it('leaves the payment unconfirmed', async () => {
    enquireTransaction.mockResolvedValue({ kind: 'unknown', reason: 'timeout' });

    const result = await settleSabPaisaPayment(MERCHANT_TXN_ID);

    expect(result.outcome).toBe('unconfirmed');
    expect(statusOf('sabpaisa_payments')).toBe('unconfirmed');
    // Critically: the order is not touched at all.
    expect(updates.some((entry) => entry.table === 'orders')).toBe(false);
  });

  it('does not trust a signed return claiming SUCCESS when enquiry is unreachable', async () => {
    enquireTransaction.mockResolvedValue({ kind: 'unknown', reason: 'network_error' });

    const result = await settleSabPaisaPayment(MERCHANT_TXN_ID, {
      status: 'SUCCESS',
      paidAmountPaise: EXPECTED_PAISE,
    });

    // A valid signature is not proof of payment.
    expect(result.outcome).toBe('unconfirmed');
  });

  it('treats an unrecognised status as unconfirmed, not as a verdict', async () => {
    enquireTransaction.mockResolvedValue(agreeingEnquiry({ status: 'SOMETHING_NEW' }));

    expect((await settleSabPaisaPayment(MERCHANT_TXN_ID)).outcome).toBe('unconfirmed');
  });
});

describe("SabPaisa's own terminal verdicts", () => {
  it.each([
    ['FAILED', 'failed'],
    ['TIMEOUT', 'failed'],
    ['EXPIRED', 'expired'],
    ['CANCELLED', 'cancelled'],
    ['ABORTED', 'cancelled'],
  ])('maps %s to %s without an amount cross-check', async (reported, expected) => {
    enquireTransaction.mockResolvedValue(
      // A wrong amount is irrelevant here: nothing is being granted.
      agreeingEnquiry({ status: reported, amountPaise: 1 }),
    );

    expect((await settleSabPaisaPayment(MERCHANT_TXN_ID)).outcome).toBe(expected);
  });
});

describe('idempotency and unknown references', () => {
  it('changes nothing for an already-settled payment', async () => {
    paymentRow = localRecord({ status: 'paid' });

    const result = await settleSabPaisaPayment(MERCHANT_TXN_ID);

    expect(result.outcome).toBe('already_settled');
    expect(updates).toHaveLength(0);
    // It must not even ask, so a duplicate return cannot re-settle.
    expect(enquireTransaction).not.toHaveBeenCalled();
  });

  it('refuses a reference it never minted', async () => {
    paymentRow = null;

    const result = await settleSabPaisaPayment('YVSP-FORGED-0000000000');

    expect(result.outcome).toBe('unknown_transaction');
    expect(updates).toHaveLength(0);
    expect(enquireTransaction).not.toHaveBeenCalled();
  });
});
