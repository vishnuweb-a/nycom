import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AirpayNamespace from './airpay.js';

/**
 * Settlement tests — the rules that decide whether money is believed to have
 * moved.
 *
 * The scenarios worth proving are the adversarial and the accidental ones:
 * a forged callback claiming SUCCESS, a duplicate delivery, a race between the
 * webhook and the browser return, and a genuine payment for the wrong amount.
 *
 * Airpay is stubbed, so `verifyTransaction` returns whatever a given test wants
 * the gateway to say. That separation is the point: it lets a test assert that a
 * callback claiming SUCCESS is ignored when the *gateway* disagrees.
 */

interface Row {
  order_ref: string;
  amount: number;
  payment_status: string;
  payment_method: string;
  access_token: string;
  ap_transactionid: string | null;
  ap_verified_at: string | null;
}

let rows: Row[] = [];

/** Terminal states the conditional UPDATE refuses to overwrite. */
const TERMINAL = ['paid', 'failed', 'cancelled', 'requires_review'];

/**
 * Minimal Supabase double.
 *
 * The `.not('payment_status', 'in', …)` predicate is modelled faithfully,
 * because that single clause *is* the idempotency mechanism — a double that
 * ignored it would make these tests pass while the real thing double-settled.
 */
vi.mock('./db.js', () => ({
  db: () => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: () =>
            Promise.resolve({
              data: rows.find((row) => row.order_ref === value) ?? null,
              error: null,
            }),
        }),
      }),
      update: (patch: Partial<Row>) => ({
        eq: (_column: string, value: string) => ({
          not: (_field: string, _operator: string, _list: string) => ({
            select: () => {
              const row = rows.find((entry) => entry.order_ref === value);

              if (row === undefined || TERMINAL.includes(row.payment_status)) {
                return Promise.resolve({ data: [], error: null });
              }

              Object.assign(row, patch);

              return Promise.resolve({ data: [{ order_ref: row.order_ref }], error: null });
            },
          }),
        }),
      }),
    }),
  }),
}));

let isLive = true;

vi.mock('./env.js', () => ({
  isLiveMid: () => isLive,
  serverEnv: () => ({
    AIRPAY_MID: 'TESTMID',
    AIRPAY_USERNAME: 'test-user',
  }),
}));

let gatewaySays: { transactionStatus: number | null; amount: number | null } | null = null;

vi.mock('./airpay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AirpayNamespace>();

  return {
    ...actual,
    verifyTransaction: () =>
      Promise.resolve(
        gatewaySays === null
          ? null
          : {
              orderId: 'YV-TEST-0001',
              apTransactionId: 'AP-REAL-1',
              amount: gatewaySays.amount,
              transactionStatus: gatewaySays.transactionStatus,
              paymentStatus: gatewaySays.transactionStatus === 200 ? 'SUCCESS' : 'FAIL',
            },
      ),
  };
});

const ORDER_REF = 'YV-TEST-0001';

const callback = (overrides: Partial<Record<string, string>> = {}) => ({
  orderRef: ORDER_REF,
  apTransactionId: 'AP-CLAIM-1',
  amount: '1999.00',
  transactionStatus: '200',
  message: 'SUCCESS',
  secureHash: '',
  ...overrides,
});

beforeEach(() => {
  process.env.AIRPAY_MID = 'TESTMID';
  process.env.AIRPAY_USERNAME = 'test-user';

  isLive = true;
  gatewaySays = { transactionStatus: 200, amount: 1999 };

  rows = [
    {
      order_ref: ORDER_REF,
      amount: 1999,
      payment_status: 'initiated',
      payment_method: 'airpay',
      access_token: 'token-1',
      ap_transactionid: null,
      ap_verified_at: null,
    },
  ];
});

const settle = async () => (await import('./settle.js')).settleOrder;

describe('settleOrder — the happy path', () => {
  it('marks an order paid when the gateway confirms it for the right amount', async () => {
    const settleOrder = await settle();

    const result = await settleOrder(callback());

    expect(result.outcome).toBe('paid');
    expect(rows[0].payment_status).toBe('paid');
    // The transaction id recorded is the gateway's, not the one the caller claimed.
    expect(rows[0].ap_transactionid).toBe('AP-REAL-1');
    expect(rows[0].ap_verified_at).not.toBeNull();
  });
});

describe('settleOrder — idempotency', () => {
  it('settles exactly once across duplicate callbacks', async () => {
    const settleOrder = await settle();

    const first = await settleOrder(callback());
    const second = await settleOrder(callback());
    const third = await settleOrder(callback());

    expect(first.outcome).toBe('paid');
    expect(second.outcome).toBe('already_settled');
    expect(third.outcome).toBe('already_settled');
    expect(rows[0].payment_status).toBe('paid');
  });

  it('settles once when the webhook and the browser return arrive together', async () => {
    const settleOrder = await settle();

    const outcomes = (await Promise.all([settleOrder(callback()), settleOrder(callback())])).map(
      (result) => result.outcome,
    );

    expect(outcomes.filter((outcome) => outcome === 'paid')).toHaveLength(1);
    expect(rows[0].payment_status).toBe('paid');
  });

  it('will not reopen a failed order', async () => {
    rows[0].payment_status = 'failed';

    const settleOrder = await settle();

    expect((await settleOrder(callback())).outcome).toBe('already_settled');
    expect(rows[0].payment_status).toBe('failed');
  });
});

describe('settleOrder — refusing to trust the caller', () => {
  /*
   * The central adversarial case. The callback body is a perfectly well-formed
   * claim of success; the gateway says the payment failed. The gateway wins.
   */
  it('ignores a callback claiming SUCCESS when the gateway says it failed', async () => {
    gatewaySays = { transactionStatus: 400, amount: 1999 };

    const settleOrder = await settle();

    const result = await settleOrder(callback({ transactionStatus: '200', message: 'SUCCESS' }));

    expect(result.outcome).toBe('failed');
    expect(rows[0].payment_status).toBe('failed');
  });

  it('ignores the amount the caller reports, using the stored one', async () => {
    // Caller claims a trivial amount; the gateway confirms the real one.
    const settleOrder = await settle();

    const result = await settleOrder(callback({ amount: '1.00' }));

    expect(result.outcome).toBe('paid');
    expect(rows[0].payment_status).toBe('paid');
  });

  it('holds the order for review when the gateway amount differs', async () => {
    gatewaySays = { transactionStatus: 200, amount: 1 };

    const settleOrder = await settle();

    const result = await settleOrder(callback());

    expect(result.outcome).toBe('amount_mismatch');
    // Neither paid nor failed: money may have moved, so this needs a human.
    expect(rows[0].payment_status).toBe('requires_review');
  });

  it('does not let a later callback overwrite a review flag', async () => {
    gatewaySays = { transactionStatus: 200, amount: 1 };

    const settleOrder = await settle();

    await settleOrder(callback());
    expect(rows[0].payment_status).toBe('requires_review');

    // A subsequent callback reporting the correct amount must not silently
    // clear the flag — the discrepancy still happened and still needs a human.
    gatewaySays = { transactionStatus: 200, amount: 1999 };

    const second = await settleOrder(callback());

    expect(second.outcome).toBe('already_settled');
    expect(rows[0].payment_status).toBe('requires_review');
  });

  it('rejects a hash that does not match when one is supplied', async () => {
    const settleOrder = await settle();

    const result = await settleOrder(callback({ secureHash: '99999999' }));

    expect(result.outcome).toBe('hash_mismatch');
    expect(rows[0].payment_status).toBe('initiated');
  });

  it('does not settle an unknown order reference', async () => {
    const settleOrder = await settle();

    const result = await settleOrder(callback({ orderRef: 'YV-NOPE-0000' }));

    expect(result.outcome).toBe('unknown_order');
  });
});

describe('settleOrder — inconclusive outcomes stay inconclusive', () => {
  it('leaves the order unsettled while the gateway reports INPROCESS', async () => {
    gatewaySays = { transactionStatus: 211, amount: 1999 };

    const settleOrder = await settle();

    const result = await settleOrder(callback());

    expect(result.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
  });

  it('leaves the order unsettled when the gateway cannot be reached', async () => {
    gatewaySays = null;

    const settleOrder = await settle();

    const result = await settleOrder(callback());

    // Not "failed" — an unreachable gateway must not strand a real payment.
    expect(result.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
  });

  /*
   * The regression that cost a real payment.
   *
   * Airpay's Order Confirmation replies to MID 366950 with an encrypted
   * envelope the code cannot yet decrypt, so it produced a confirmation with no
   * transaction status. `null !== 200`, so the order fell through into `failed`
   * and was terminally marked wrong. Order YV-3200A-2AB47227 — a genuine ₹81
   * UPI payment — was destroyed that way.
   *
   * A missing status is an unknown. Only a status Airpay actually stated may
   * fail an order.
   */
  it('will not fail an order on a confirmation carrying no transaction status', async () => {
    gatewaySays = { transactionStatus: null, amount: null };

    const settleOrder = await settle();

    const result = await settleOrder(callback());

    expect(result.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
  });

  /*
   * Order Confirmation does not work on a sandbox MID, so there is no trusted
   * source of truth available. The order therefore stays unsettled rather than
   * falling back to believing the callback — which is exactly the hole this
   * module exists to close.
   */
  it('refuses to settle on a sandbox MID rather than trusting the callback', async () => {
    isLive = false;

    const settleOrder = await settle();

    const result = await settleOrder(callback());

    expect(result.outcome).toBe('unverifiable');
    expect(rows[0].payment_status).toBe('initiated');
  });
});

describe('cancelOrder', () => {
  it('cancels an initiated order', async () => {
    const { cancelOrder } = await import('./settle.js');

    expect(await cancelOrder(ORDER_REF)).toBe(true);
    expect(rows[0].payment_status).toBe('cancelled');
  });

  it('cannot cancel an order that has already been paid', async () => {
    rows[0].payment_status = 'paid';

    const { cancelOrder } = await import('./settle.js');

    expect(await cancelOrder(ORDER_REF)).toBe(false);
    expect(rows[0].payment_status).toBe('paid');
  });
});
