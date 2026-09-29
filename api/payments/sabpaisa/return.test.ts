import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { returnSignatureBase, type ReturnSignedParam } from '../../_lib/sabpaisa/crypto.js';

/**
 * The return handler must fail closed.
 *
 * These tests drive the endpoint directly with fake request/response objects.
 * `settle.js` and `db.js` are mocked, so nothing here reaches a network or a
 * database — a hard requirement, since this file exercises the live payment
 * return path.
 *
 * The question each test asks is the same: can a request that has NOT been
 * proven authentic cause a payment to be treated as settled?
 */

const settleSabPaisaPayment = vi.fn();

vi.mock('../../_lib/sabpaisa/settle.js', () => ({
  settleSabPaisaPayment: () => settleSabPaisaPayment() as unknown,
}));

vi.mock('../../_lib/db.js', () => ({
  db: () => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () =>
        Promise.resolve({ data: { access_token: 'the-opaque-read-key' }, error: null }),
    };

    return { from: () => chain };
  },
}));

const SECRET = 'test-secret-key-not-a-real-credential';

const PARAMS: Record<ReturnSignedParam, string> = {
  amount: '1499.00',
  merchant_txn_id: 'YVSP-ABC123-DEADBEEF01',
  paid_amount: '1499.00',
  payment_mode: 'UPI',
  status: 'SUCCESS',
  timestamp: '1758000000000',
  transaction_id: 'SP1234567890',
};

const sign = (params: Record<ReturnSignedParam, string>): string =>
  createHmac('sha256', SECRET).update(returnSignatureBase(params), 'utf8').digest('hex');

/** A minimal VercelResponse double that records what the handler did. */
const makeRes = () => {
  const state = { status: 0, location: '', headers: {} as Record<string, unknown> };

  const res = {
    setHeader: (key: string, value: unknown) => {
      state.headers[key] = value;

      return res;
    },
    redirect: (status: number, location: string) => {
      state.status = status;
      state.location = location;

      return res;
    },
    status: () => res,
    json: () => res,
  };

  return { res, state };
};

let handler: (req: unknown, res: unknown) => Promise<void>;

beforeEach(async () => {
  process.env.SABPAISA_CLIENT_CODE = 'TESTCC';
  process.env.SABPAISA_MERCHANT_ID = 'TESTMI';
  process.env.SABPAISA_API_KEY = 'test-api-key';
  process.env.SABPAISA_SECRET_KEY = SECRET;
  process.env.SABPAISA_BASE_URL = 'https://merchant-api.sabpaisa.in';
  process.env.PUBLIC_SITE_ORIGIN = 'https://www.yarnvia.online';

  const { resetSabPaisaEnvCache } = await import('../../_lib/sabpaisa/env.js');

  resetSabPaisaEnvCache();
  settleSabPaisaPayment.mockReset();
  settleSabPaisaPayment.mockResolvedValue({
    outcome: 'paid',
    merchantTxnId: PARAMS.merchant_txn_id,
    orderRef: 'YV-ABCDE-12345678',
    status: 'SUCCESS',
  });

  handler = (await import('./return.js')).default as typeof handler;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('a validly signed return', () => {
  it('runs settlement and redirects with the reference and opaque read key', async () => {
    const { res, state } = makeRes();

    await handler({ method: 'GET', query: { ...PARAMS, signature: sign(PARAMS) } }, res);

    expect(settleSabPaisaPayment).toHaveBeenCalledTimes(1);
    expect(state.status).toBe(303);
    expect(state.location).toContain('ref=YV-ABCDE-12345678');
    expect(state.location).toContain('t=the-opaque-read-key');
  });

  it('never puts an outcome claim in the confirmation URL', async () => {
    const { res, state } = makeRes();

    await handler({ method: 'GET', query: { ...PARAMS, signature: sign(PARAMS) } }, res);

    // The success page must ask the server, not read a query parameter.
    expect(state.location).not.toContain('status=SUCCESS');
    expect(state.location).not.toContain('paid');
    expect(state.location).not.toContain('1499');
  });

  it('accepts a form POST return as well as a query-string GET', async () => {
    const { res, state } = makeRes();

    await handler({ method: 'POST', query: {}, body: { ...PARAMS, signature: sign(PARAMS) } }, res);

    expect(settleSabPaisaPayment).toHaveBeenCalledTimes(1);
    expect(state.status).toBe(303);
  });
});

describe('an invalid signature must not settle anything', () => {
  it('refuses a forged signature', async () => {
    const { res, state } = makeRes();

    await handler({ method: 'GET', query: { ...PARAMS, signature: 'a'.repeat(64) } }, res);

    // The critical assertion: settlement was never even attempted.
    expect(settleSabPaisaPayment).not.toHaveBeenCalled();
    expect(state.location).toContain('status=unknown');
  });

  it('refuses a return whose status was tampered from FAILED to SUCCESS', async () => {
    const { res } = makeRes();
    const signature = sign({ ...PARAMS, status: 'FAILED' });

    await handler({ method: 'GET', query: { ...PARAMS, status: 'SUCCESS', signature } }, res);

    expect(settleSabPaisaPayment).not.toHaveBeenCalled();
  });

  it('refuses a return whose amount was tampered downward', async () => {
    const { res } = makeRes();
    const signature = sign(PARAMS);

    await handler({ method: 'GET', query: { ...PARAMS, paid_amount: '1.00', signature } }, res);

    expect(settleSabPaisaPayment).not.toHaveBeenCalled();
  });

  it('refuses a return with no signature at all', async () => {
    const { res, state } = makeRes();

    await handler({ method: 'GET', query: { ...PARAMS } }, res);

    expect(settleSabPaisaPayment).not.toHaveBeenCalled();
    expect(state.location).toContain('status=unknown');
  });

  it('refuses a return missing a signed parameter rather than signing over a partial set', async () => {
    const { res } = makeRes();
    const partial = { ...PARAMS };

    delete (partial as Record<string, unknown>).paid_amount;

    await handler({ method: 'GET', query: { ...partial, signature: sign(PARAMS) } }, res);

    expect(settleSabPaisaPayment).not.toHaveBeenCalled();
  });

  it('refuses a bare visit to the return URL by a curious shopper', async () => {
    const { res, state } = makeRes();

    await handler({ method: 'GET', query: {} }, res);

    expect(settleSabPaisaPayment).not.toHaveBeenCalled();
    expect(state.location).toBe('https://www.yarnvia.online/order-success?status=unknown');
  });
});

describe('outcomes that are not success', () => {
  it('still redirects to the order page for an unconfirmed payment', async () => {
    settleSabPaisaPayment.mockResolvedValue({
      outcome: 'unconfirmed',
      merchantTxnId: PARAMS.merchant_txn_id,
      orderRef: 'YV-ABCDE-12345678',
      status: null,
    });

    const { res, state } = makeRes();

    await handler({ method: 'GET', query: { ...PARAMS, signature: sign(PARAMS) } }, res);

    // The page will poll and keep showing "confirming", never a false success.
    expect(state.status).toBe(303);
    expect(state.location).toContain('ref=YV-ABCDE-12345678');
    expect(state.location).not.toContain('status=');
  });

  it('sends an unrecognised reference to the unknown page', async () => {
    settleSabPaisaPayment.mockResolvedValue({
      outcome: 'unknown_transaction',
      merchantTxnId: PARAMS.merchant_txn_id,
      orderRef: null,
      status: null,
    });

    const { res, state } = makeRes();

    await handler({ method: 'GET', query: { ...PARAMS, signature: sign(PARAMS) } }, res);

    expect(state.location).toContain('status=unknown');
  });
});

describe('caching', () => {
  it('marks the redirect no-store so no shared cache retains it', async () => {
    const { res, state } = makeRes();

    await handler({ method: 'GET', query: { ...PARAMS, signature: sign(PARAMS) } }, res);

    expect(state.headers['Cache-Control']).toBe('no-store');
  });
});
