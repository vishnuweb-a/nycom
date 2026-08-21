import { Readable } from 'node:stream';

import type { VercelRequest } from '@vercel/node';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The whole settlement path, end to end, with only the network stubbed.
 *
 * Every other suite cuts the path somewhere: `settle.test.ts` replaces
 * `verifyTransaction`, and `collection.test.ts` replaces it too. Both are the
 * right call for what they test, and both are blind to the thing that was
 * actually broken — the request `verifyTransaction` puts on the wire, and what
 * settlement does with the answer that comes back.
 *
 * So this suite stubs `fetch` and nothing else:
 *
 *   callback body → processAirpayCallback → settleOrder → verifyTransaction
 *                 → (stubbed Airpay HTTP) → settlement decision → row
 *
 * The rule it exists to hold: **the callback is a trigger, never evidence.**
 * Each test hands settlement a callback claiming a successful ₹81 payment and
 * varies only what Airpay says. The callback never decides the outcome.
 */

const MID = '366950';
const ORDER_REF = 'YV-3200A-2AB47227';
const AMOUNT = 81;

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE = 'test-service-role';
  process.env.AIRPAY_MID = MID;
  process.env.AIRPAY_CLIENT_ID = 'test-client-id';
  process.env.AIRPAY_API_KEY = 'test-api-key';
  process.env.AIRPAY_SECRET_KEY = 'test-secret';
  process.env.AIRPAY_USERNAME = 'test-user';
  process.env.AIRPAY_PASSWORD = 'test-pass';
  // Order Confirmation only works against a live MID, and settlement refuses
  // to run without one — so the whole path is only exercisable as 'live'.
  process.env.AIRPAY_ENV = 'live';
});

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
let transitions = 0;

/** Terminal states the conditional UPDATE refuses to overwrite. */
const TERMINAL = ['paid', 'failed', 'cancelled', 'requires_review'];

/**
 * Minimal Supabase double, matching the ones in the sibling suites. The
 * `.not('payment_status', 'in', …)` predicate is modelled faithfully because
 * that clause *is* the idempotency mechanism.
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
              transitions += 1;

              return Promise.resolve({ data: [{ order_ref: row.order_ref }], error: null });
            },
          }),
        }),
      }),
    }),
  }),
}));

/** The relay is auxiliary and must never influence settlement. */
const forwardCallback = vi.fn(() => Promise.resolve());

vi.mock('./relay.js', () => ({ forwardCallback: () => forwardCallback() }));

/** What the stubbed gateway does when asked about the order. */
interface GatewayScript {
  /** The Order Confirmation body, when it answers at all. */
  readonly body?: unknown;
  /** Answer with a non-2xx instead. */
  readonly httpStatus?: number;
  /** Refuse the connection — a timeout or a DNS failure. */
  readonly unreachable?: boolean;
}

let script: GatewayScript = {};
/** Every URL fetched, in order, so the request itself can be asserted on. */
let requested: string[] = [];

/**
 * Routes by URL rather than by call order, because the OAuth token is cached
 * module-scoped: the second settlement in a test does not re-authenticate, and
 * a queue-based stub would silently hand it the wrong response.
 */
const stubGateway = () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((...args: unknown[]) => {
      const url = args[0] as string;

      requested.push(url);

      if (url.includes('/oauth2/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access_token: 'tok-flow', expires_in: 300 }),
        } as unknown as Response);
      }

      if (script.unreachable === true) {
        return Promise.reject(new Error('The operation was aborted'));
      }

      return Promise.resolve({
        ok: script.httpStatus === undefined,
        status: script.httpStatus ?? 200,
        json: () => Promise.resolve(script.body ?? null),
      } as unknown as Response);
    }),
  );
};

/** A confirmation stating a given status and amount. */
const confirms = (transactionStatus: string, amount: string = '81.00') => ({
  data: {
    orderid: ORDER_REF,
    ap_transactionid: '2051234202',
    amount,
    transaction_status: transactionStatus,
    transaction_payment_status: transactionStatus === '200' ? 'SUCCESS' : 'FAIL',
  },
});

/**
 * A callback claiming an entirely successful ₹81 payment. It is identical in
 * every test; only Airpay's answer changes.
 *
 * `ap_SecureHash` is omitted deliberately — settlement skips the CRC32 check
 * when no hash is supplied, exactly as it does for the reconciliation sweep and
 * the success-page poll, so these tests isolate verification.
 */
const CALLBACK = {
  MERCID: MID,
  TRANSACTIONID: ORDER_REF,
  APTRANSACTIONID: '2051234202',
  AMOUNT: '81.00',
  TRANSACTIONSTATUS: '200',
  MESSAGE: 'SUCCESS',
} as const;

const request = (body: unknown = CALLBACK): VercelRequest =>
  ({ body, query: {}, method: 'POST', headers: {} }) as VercelRequest;

/** Runs one inbound callback through the real pipeline. */
const deliver = async (body: unknown = CALLBACK) => {
  const { processAirpayCallback } = await import('./callbackFlow.js');

  return processAirpayCallback(request(body), { leg: 'ipn', relay: true });
};

beforeEach(async () => {
  const { resetTokenCache } = await import('./airpay.js');

  resetTokenCache();
  forwardCallback.mockClear();

  transitions = 0;
  requested = [];
  script = { body: confirms('200') };

  rows = [
    {
      order_ref: ORDER_REF,
      amount: AMOUNT,
      payment_status: 'initiated',
      payment_method: 'airpay',
      access_token: 'read-key-1',
      ap_transactionid: null,
      ap_verified_at: null,
    },
  ];

  stubGateway();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('callback → settlement, with Airpay as the authority', () => {
  it('marks the order paid when Airpay confirms it for the exact amount', async () => {
    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('paid');
    expect(rows[0].payment_status).toBe('paid');
    // Airpay's transaction id, from the confirmation — not the one the caller
    // put in the callback body.
    expect(rows[0].ap_transactionid).toBe('2051234202');
    expect(rows[0].ap_verified_at).not.toBeNull();
  });

  it('verifies against /api/verify/ before writing anything', async () => {
    await deliver();

    expect(requested[0]).toContain('/api/oauth2/');
    expect(requested[1]).toContain('/api/verify/');
    expect(requested[1]).not.toContain('/api/orderconfirmation/');
  });

  it('fails the order when Airpay states a failure, whatever the callback claims', async () => {
    script = { body: confirms('400') };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('failed');
    expect(rows[0].payment_status).toBe('failed');
  });

  it('leaves the order open while Airpay reports the payment in process', async () => {
    script = { body: confirms('211') };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
    expect(transitions).toBe(0);
  });
});

/**
 * The rule the earlier revision broke: an answer we cannot obtain, or cannot
 * read, is an unknown. It leaves the order exactly where it was — open for the
 * next callback, the success-page poll, or the reconciliation sweep to resolve.
 *
 * Marking it `failed` is the failure mode that destroyed order
 * YV-3200A-2AB47227, a genuine ₹81 UPI payment. Marking it `requires_review`
 * would be no better here: `requires_review` is terminal in this codebase, so a
 * gateway outage would permanently strand every payment in flight rather than
 * letting the sweep re-check it. "No write" is how this codebase parks an order
 * for review.
 */
describe('an answer we cannot get is never a failed payment', () => {
  it('holds the order when Airpay is unreachable', async () => {
    script = { unreachable: true };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
    expect(transitions).toBe(0);
  });

  it('holds the order on a non-2xx from Airpay', async () => {
    script = { httpStatus: 502, body: { error: 'bad gateway' } };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
  });

  /* The live observation: a well-formed envelope our key will not open. */
  it('holds the order when the answer will not decrypt', async () => {
    script = {
      body: {
        merchant_id: null,
        response: `509361e8503ab0a0${Buffer.from('x'.repeat(96)).toString('base64')}`,
      },
    };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
    expect(transitions).toBe(0);
  });

  it('holds the order when the answer carries no transaction status', async () => {
    script = { body: { merchant_id: null, message: 'not modelled' } };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
  });

  /*
   * status_code 200, response_code "00", status "success" — and data.success
   * false. The outer envelope describes the transport, not the outcome. This
   * must stay an error, and it must not settle anything.
   */
  it('holds the order on an inner failure wearing an outer success', async () => {
    script = {
      body: {
        status_code: 200,
        response_code: '00',
        status: 'success',
        message: 'Success',
        data: { success: false, msg: 'Invalid order id', transaction_status: '200' },
      },
    };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
    expect(transitions).toBe(0);
  });

  it('holds the order when Airpay answers about a different order', async () => {
    script = { body: { data: { orderid: 'YV-OTHER-99999999', transaction_status: '200' } } };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('pending');
    expect(rows[0].payment_status).toBe('initiated');
  });
});

describe('the amount is checked against the one we priced', () => {
  it('will not pay an order out on a different amount', async () => {
    script = { body: confirms('200', '1.00') };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('amount_mismatch');
    // Neither paid nor failed: money may have moved, just not our amount.
    expect(rows[0].payment_status).toBe('requires_review');
  });

  it('ignores the amount the callback claims, using the stored one', async () => {
    const { settlement } = await deliver({ ...CALLBACK, AMOUNT: '1.00' });

    expect(settlement?.outcome).toBe('paid');
    expect(rows[0].payment_status).toBe('paid');
  });

  it('will not pay an order out when Airpay states no amount', async () => {
    script = { body: { data: { orderid: ORDER_REF, transaction_status: '200' } } };

    const { settlement } = await deliver();

    expect(settlement?.outcome).toBe('amount_mismatch');
    expect(rows[0].payment_status).toBe('requires_review');
  });
});

describe('the callback is a trigger, not evidence', () => {
  it('does not pay out on a callback claiming SUCCESS when Airpay disagrees', async () => {
    script = { body: confirms('400') };

    const { settlement } = await deliver({ ...CALLBACK, TRANSACTIONSTATUS: '200' });

    expect(settlement?.outcome).toBe('failed');
    expect(rows[0].payment_status).toBe('failed');
  });

  it('does not pay out on a forged callback for an order Airpay cannot confirm', async () => {
    script = { unreachable: true };

    await deliver();

    expect(rows[0].payment_status).toBe('initiated');
  });
});

describe('duplicate delivery', () => {
  it('settles exactly once across repeated callbacks', async () => {
    const first = await deliver();
    const second = await deliver();
    const third = await deliver();

    expect(first.settlement?.outcome).toBe('paid');
    expect(second.settlement?.outcome).toBe('already_settled');
    expect(third.settlement?.outcome).toBe('already_settled');
    expect(transitions).toBe(1);
  });

  it('settles once when two callbacks arrive together', async () => {
    const outcomes = (await Promise.all([deliver(), deliver()])).map(
      (result) => result.settlement?.outcome,
    );

    expect(outcomes.filter((outcome) => outcome === 'paid')).toHaveLength(1);
    expect(transitions).toBe(1);
  });

  /*
   * The duplicate is answered from the row, before any Order Confirmation call
   * is made — a retry storm must not become a request storm at Airpay.
   */
  it('does not re-verify an order that is already settled', async () => {
    await deliver();

    const before = requested.length;

    await deliver();

    expect(requested).toHaveLength(before);
  });
});

describe('the relay stays auxiliary', () => {
  it('forwards the callback after settlement has completed', async () => {
    await deliver();

    expect(rows[0].payment_status).toBe('paid');
    expect(forwardCallback).toHaveBeenCalledTimes(1);
  });

  it('forwards an unverifiable callback too, without settling it', async () => {
    script = { unreachable: true };

    await deliver();

    expect(forwardCallback).toHaveBeenCalledTimes(1);
    expect(rows[0].payment_status).toBe('initiated');
  });
});

/**
 * The production failure of 2026-08-21, end to end.
 *
 * A real ₹83 payment (YV-ABJ5T-3C1DDCEF) completed at Airpay and the customer
 * reached the success page, but both callback legs logged
 * `payment.callback.unparseable` and nothing settled. The cause was not the
 * parser's field handling — it was that the body never reached the parser:
 * Vercel hands `req.body` as `undefined` for any content type outside json /
 * urlencoded / text-plain / octet-stream, leaving the bytes in the stream.
 *
 * These deliver through the real pipeline with `body` undefined and the payload
 * only in the stream, which is what production actually looks like. They fail
 * against the previous revision and pass against this one.
 */
describe('a callback the platform did not parse still settles', () => {
  const BOUNDARY = '----AirpayFormBoundary7MA4YWxkTrZu0gW';

  const multipart = (fields: Record<string, string>): string =>
    `${Object.entries(fields)
      .map(
        ([name, value]) =>
          `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      )
      .join('')}--${BOUNDARY}--\r\n`;

  /** A request whose payload exists only in the stream, as Vercel delivers it. */
  const streamed = (raw: string): VercelRequest =>
    Object.assign(Readable.from([Buffer.from(raw, 'utf8')]), {
      body: undefined,
      query: {},
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    }) as unknown as VercelRequest;

  const deliverStream = async (raw: string, leg: 'ipn' | 'browser' = 'ipn') => {
    const { processAirpayCallback } = await import('./callbackFlow.js');

    return processAirpayCallback(streamed(raw), { leg, relay: true });
  };

  it('settles an IPN delivered as multipart/form-data', async () => {
    const { settlement, parsed } = await deliverStream(multipart(CALLBACK));

    expect(parsed).not.toBeNull();
    expect(parsed?.payload.orderRef).toBe(ORDER_REF);
    // Settlement still came from Airpay, not from the body that was parsed.
    expect(requested[1]).toContain('/api/verify/');
    expect(settlement?.outcome).toBe('paid');
    expect(rows[0].payment_status).toBe('paid');
    expect(rows[0].ap_transactionid).toBe('2051234202');
  });

  it('settles the browser Response leg delivered as multipart/form-data', async () => {
    const { settlement, parsed } = await deliverStream(multipart(CALLBACK), 'browser');

    expect(parsed?.payload.orderRef).toBe(ORDER_REF);
    expect(settlement?.outcome).toBe('paid');
    expect(rows[0].payment_status).toBe('paid');
  });

  it('forwards the multipart fields to KKChat verbatim, after settling', async () => {
    await deliverStream(multipart(CALLBACK));

    expect(rows[0].payment_status).toBe('paid');
    expect(forwardCallback).toHaveBeenCalledTimes(1);
  });

  it('still refuses a streamed body carrying no order reference', async () => {
    const { parsed, settlement } = await deliverStream('--nonsense--\r\n');

    expect(parsed).toBeNull();
    expect(settlement).toBeNull();
    expect(rows[0].payment_status).toBe('initiated');
    expect(transitions).toBe(0);
  });

  /*
   * The body being readable changes nothing about who decides the outcome. A
   * multipart callback claiming SUCCESS settles on Airpay's answer alone.
   */
  it('does not let a readable multipart body decide the outcome', async () => {
    script = { body: confirms('400') };

    const { settlement } = await deliverStream(
      multipart({ ...CALLBACK, TRANSACTIONSTATUS: '200', MESSAGE: 'SUCCESS' }),
    );

    expect(settlement?.outcome).toBe('failed');
    expect(rows[0].payment_status).toBe('failed');
  });

  it('holds a multipart callback whose SecureHash does not match', async () => {
    const { settlement } = await deliverStream(
      multipart({ ...CALLBACK, ap_SecureHash: '999999999' }),
    );

    expect(settlement?.outcome).toBe('hash_mismatch');
    expect(rows[0].payment_status).toBe('initiated');
    expect(transitions).toBe(0);
  });

  it('settles a multipart delivery exactly once when Airpay retries it', async () => {
    const first = await deliverStream(multipart(CALLBACK));
    const second = await deliverStream(multipart(CALLBACK));

    expect(first.settlement?.outcome).toBe('paid');
    expect(second.settlement?.outcome).toBe('already_settled');
    expect(transitions).toBe(1);
  });
});
