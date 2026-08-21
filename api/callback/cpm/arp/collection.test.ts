import { readFileSync } from 'node:fs';

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AirpayNamespace from '../../../_lib/airpay.js';

/**
 * End-to-end tests for the URL Airpay actually calls.
 *
 * These are deliberately *not* mocked at `settleOrder`. The sibling suite for
 * `/api/payments/callback` stubs settlement to isolate the relay; this one runs
 * the real settlement against a stubbed database and a stubbed gateway, because
 * the thing that broke in production was the wiring between the route and the
 * settlement — and a test that mocks the settlement cannot see wiring.
 *
 * Airpay is stubbed so a test can make the gateway disagree with the callback.
 * That separation is the whole point: it lets these tests assert that a
 * callback claiming SUCCESS on the public URL settles nothing when the gateway
 * says otherwise.
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

/** How many UPDATE statements actually changed a row. */
let transitions = 0;

/**
 * Minimal Supabase double, matching the one in `_lib/settle.test.ts`.
 *
 * The `.not('payment_status', 'in', …)` predicate is modelled faithfully,
 * because that single clause *is* the idempotency mechanism — a double that
 * ignored it would make these tests pass while the real thing double-settled.
 */
vi.mock('../../../_lib/db.js', () => ({
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

let gatewaySays: { transactionStatus: number | null; amount: number | null } | null = null;

/**
 * Only `verifyTransaction` is replaced. `encrypt` stays real, so the encrypted
 * envelope test exercises the genuine cipher rather than a stand-in for it.
 */
vi.mock('../../../_lib/airpay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AirpayNamespace>();

  return {
    ...actual,
    verifyTransaction: () =>
      Promise.resolve(
        gatewaySays === null
          ? null
          : {
              orderId: ORDER_REF,
              apTransactionId: 'AP-REAL-1',
              amount: gatewaySays.amount,
              transactionStatus: gatewaySays.transactionStatus,
              paymentStatus: gatewaySays.transactionStatus === 200 ? 'SUCCESS' : 'FAIL',
            },
      ),
  };
});

const ORDER_REF = 'YV-3200A-2AB47227';

interface Captured {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  location: string | null;
}

/** Minimal VercelResponse double capturing what the handler sent. */
const responseDouble = () => {
  const captured: Captured = { status: 0, body: null, headers: {}, location: null };

  const res = {
    status(code: number) {
      captured.status = code;

      return res;
    },
    setHeader(key: string, value: string) {
      captured.headers[key] = value;

      return res;
    },
    json(payload: unknown) {
      captured.body = payload;

      return res;
    },
    redirect(code: number, location: string) {
      captured.status = code;
      captured.location = location;

      return res;
    },
  };

  return { res: res as unknown as VercelResponse, captured };
};

interface RequestOptions {
  readonly body?: unknown;
  readonly query?: Record<string, string>;
  readonly method?: string;
  readonly headers?: Record<string, string>;
}

const request = (options: RequestOptions = {}): VercelRequest =>
  ({
    body: options.body,
    query: options.query ?? {},
    method: options.method ?? 'POST',
    headers: options.headers ?? {},
  }) as VercelRequest;

/** A realistic Airpay success callback for the live ₹81 order. */
const CALLBACK = {
  MERCID: '366950',
  TRANSACTIONID: ORDER_REF,
  APTRANSACTIONID: '2051234202',
  AMOUNT: '81.00',
  TRANSACTIONSTATUS: '200',
  MESSAGE: 'SUCCESS',
  CUSTOMERVPA: 'someone@okbank',
} as const;

/** Headers a browser sends on a top-level navigation, and a server does not. */
const BROWSER_HEADERS = {
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  accept: 'text/html,application/xhtml+xml',
} as const;

type FetchLike = (...args: unknown[]) => Promise<unknown>;

let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;

const publicRoute = async () => (await import('./collection.js')).default;
const internalRoute = async () => (await import('../../../payments/callback.js')).default;

const invoke = async (
  route: (req: VercelRequest, res: VercelResponse) => Promise<void>,
  options: RequestOptions = {},
) => {
  const { res, captured } = responseDouble();

  await route(request(options), res);

  return captured;
};

const post = async (options: RequestOptions = {}) => invoke(await publicRoute(), options);

beforeEach(() => {
  vi.resetModules();
  delete process.env.KKCHAT_CALLBACK_URL;

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE = 'test-service-role';
  process.env.AIRPAY_MID = '366950';
  process.env.AIRPAY_CLIENT_ID = 'test-client-id';
  process.env.AIRPAY_API_KEY = 'test-api-key';
  process.env.AIRPAY_SECRET_KEY = 'test-secret';
  process.env.AIRPAY_USERNAME = 'test-user';
  process.env.AIRPAY_PASSWORD = 'test-pass';
  process.env.AIRPAY_ENV = 'live';
  process.env.PUBLIC_SITE_ORIGIN = 'https://www.yarnvia.online';

  transitions = 0;
  gatewaySays = { transactionStatus: 200, amount: 81 };

  rows = [
    {
      order_ref: ORDER_REF,
      amount: 81,
      payment_status: 'initiated',
      payment_method: 'airpay',
      access_token: 'read-key-1',
      ap_transactionid: null,
      ap_verified_at: null,
    },
  ];

  fetchMock = vi.fn<FetchLike>().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);

  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

// ─── The shapes Airpay may deliver ──────────────────────────────────────────

describe('POST /callback/cpm/arp/collection — accepted payload shapes', () => {
  it('settles a form-urlencoded body the platform left as a raw string', async () => {
    const form = new URLSearchParams({ ...CALLBACK }).toString();

    const captured = await post({ body: form });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('settles a form-urlencoded body the platform parsed into an object', async () => {
    const captured = await post({ body: { ...CALLBACK } });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('settles a JSON body', async () => {
    const captured = await post({
      body: { ...CALLBACK },
      headers: { 'content-type': 'application/json' },
    });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('settles a body delivered as a Buffer', async () => {
    const captured = await post({ body: Buffer.from(JSON.stringify(CALLBACK), 'utf8') });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('settles a GET carrying the fields in the query string', async () => {
    const captured = await post({ method: 'GET', body: undefined, query: { ...CALLBACK } });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('settles an encrypted Airpay envelope', async () => {
    const { encrypt } = await import('../../../_lib/airpay.js');

    const captured = await post({ body: { encdata: encrypt({ ...CALLBACK }) } });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('rejects a method Airpay never uses', async () => {
    const captured = await post({ method: 'DELETE', body: { ...CALLBACK } });

    expect(captured.status).toBe(405);
    expect(rows[0]?.payment_status).toBe('initiated');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Settlement outcomes, reached through the public URL ────────────────────

describe('POST /callback/cpm/arp/collection — settlement outcomes', () => {
  it('marks the order paid when the gateway confirms it for the priced amount', async () => {
    const captured = await post({ body: { ...CALLBACK } });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(rows[0]?.ap_transactionid).toBe('AP-REAL-1');
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('marks the order failed when the gateway reports a failure', async () => {
    gatewaySays = { transactionStatus: 400, amount: 81 };

    const captured = await post({
      body: { ...CALLBACK, TRANSACTIONSTATUS: '400', MESSAGE: 'FAIL' },
    });

    expect(rows[0]?.payment_status).toBe('failed');
    expect(captured.body).toEqual({ received: true, outcome: 'failed' });
  });

  /*
   * The rule the whole integration rests on. The callback is not evidence.
   */
  it('refuses to pay out on a callback claiming SUCCESS when the gateway disagrees', async () => {
    gatewaySays = { transactionStatus: 400, amount: 81 };

    await post({ body: { ...CALLBACK, TRANSACTIONSTATUS: '200', MESSAGE: 'SUCCESS' } });

    expect(rows[0]?.payment_status).toBe('failed');
  });

  it('holds the order for review when the gateway settled a different amount', async () => {
    gatewaySays = { transactionStatus: 200, amount: 1 };

    const captured = await post({ body: { ...CALLBACK, AMOUNT: '81.00' } });

    expect(rows[0]?.payment_status).toBe('requires_review');
    expect(captured.body).toEqual({ received: true, outcome: 'amount_mismatch' });
  });

  /*
   * The regression this route surfaced on its first real callback. Airpay
   * answered with an envelope the code could not decrypt, so the confirmation
   * carried no transaction status — and `null !== 200` sent the order straight
   * into `failed`. A ₹81 payment that Airpay's dashboard shows as successful
   * was terminally marked failed by it.
   */
  it('leaves the order alone when the gateway answer is unreadable', async () => {
    gatewaySays = { transactionStatus: null, amount: null };

    const captured = await post({ body: { ...CALLBACK } });

    expect(rows[0]?.payment_status).toBe('initiated');
    expect(transitions).toBe(0);
    expect(captured.body).toEqual({ received: true, outcome: 'pending' });
  });

  it('changes nothing for an unknown order reference', async () => {
    const captured = await post({ body: { ...CALLBACK, TRANSACTIONID: 'YV-NOPE-00000000' } });

    expect(rows[0]?.payment_status).toBe('initiated');
    expect(transitions).toBe(0);
    expect(captured.body).toEqual({ received: true, outcome: 'unknown_order' });
  });

  it('answers 200 to a malformed callback without settling or relaying', async () => {
    const captured = await post({ body: 'this is not a callback' });

    expect(transitions).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ received: true });
  });
});

// ─── Idempotency ────────────────────────────────────────────────────────────

describe('POST /callback/cpm/arp/collection — duplicate delivery', () => {
  it('settles exactly once across a repeated delivery', async () => {
    const first = await post({ body: { ...CALLBACK } });
    const second = await post({ body: { ...CALLBACK } });

    expect(transitions).toBe(1);
    expect(first.body).toEqual({ received: true, outcome: 'paid' });
    expect(second.body).toEqual({ received: true, outcome: 'already_settled' });
    expect(rows[0]?.payment_status).toBe('paid');
  });

  it('settles exactly once when two deliveries race', async () => {
    const route = await publicRoute();

    const outcomes = await Promise.all([
      invoke(route, { body: { ...CALLBACK } }),
      invoke(route, { body: { ...CALLBACK } }),
    ]);

    expect(transitions).toBe(1);
    expect(rows[0]?.payment_status).toBe('paid');

    const reported = outcomes
      .map((captured) => (captured.body as { outcome: string }).outcome)
      .sort();

    expect(reported).toEqual(['already_settled', 'paid']);
  });

  it('does not reopen an order that already failed', async () => {
    rows[0].payment_status = 'failed';

    const captured = await post({ body: { ...CALLBACK } });

    expect(rows[0]?.payment_status).toBe('failed');
    expect(transitions).toBe(0);
    expect(captured.body).toEqual({ received: true, outcome: 'already_settled' });
  });
});

// ─── The KKChat relay ───────────────────────────────────────────────────────

describe('POST /callback/cpm/arp/collection — the KKChat relay', () => {
  it('forwards to KKChat after settlement, never before', async () => {
    const sequence: string[] = [];

    fetchMock.mockImplementation(() => {
      sequence.push(`relay:${rows[0]?.payment_status ?? 'gone'}`);

      return Promise.resolve({ ok: true, status: 200 });
    });

    await post({ body: { ...CALLBACK } });

    // The relay observed an order that was already paid, so it cannot have run
    // first.
    expect(sequence).toEqual(['relay:paid']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('posts the Airpay fields verbatim as a JSON object to the KKChat URL', async () => {
    await post({ body: { ...CALLBACK } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('https://kkchat.in/callback/cpm/arp/collection');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const decoded: unknown = JSON.parse(init.body as string);

    // An object, not a JSON string containing JSON, and not form data.
    expect(typeof decoded).toBe('object');
    expect(decoded).toEqual(CALLBACK);
  });

  it('does not undo settlement when KKChat is unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));

    const captured = await post({ body: { ...CALLBACK } });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('does not undo settlement when KKChat returns 500, and does not retry', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const captured = await post({ body: { ...CALLBACK } });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('relays the browser leg too, since Airpay registers one URL for both', async () => {
    await post({ body: { ...CALLBACK }, headers: { ...BROWSER_HEADERS } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─── One URL, two kinds of caller ───────────────────────────────────────────

describe('POST /callback/cpm/arp/collection — browser return vs IPN', () => {
  it('redirects a browser to the order-success page carrying the read key', async () => {
    const captured = await post({ body: { ...CALLBACK }, headers: { ...BROWSER_HEADERS } });

    expect(captured.status).toBe(303);
    expect(captured.location).toBe(
      'https://www.yarnvia.online/order-success?ref=YV-3200A-2AB47227&t=read-key-1',
    );
  });

  it('settles the browser leg server-side rather than trusting the redirect', async () => {
    await post({ body: { ...CALLBACK }, headers: { ...BROWSER_HEADERS } });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(rows[0]?.ap_verified_at).not.toBeNull();
  });

  /*
   * The redirect is a courtesy, not a verdict. A browser that arrives claiming
   * SUCCESS still reaches the success page — but the order behind it is settled
   * by what the gateway said, and the page reads that.
   */
  it('never lets the browser leg bypass gateway verification', async () => {
    gatewaySays = { transactionStatus: 400, amount: 81 };

    const captured = await post({
      body: { ...CALLBACK, TRANSACTIONSTATUS: '200' },
      headers: { ...BROWSER_HEADERS },
    });

    expect(captured.status).toBe(303);
    expect(rows[0]?.payment_status).toBe('failed');
  });

  it('sends a browser with no order reference to the unknown-status page', async () => {
    const captured = await post({ body: 'junk', headers: { ...BROWSER_HEADERS } });

    expect(captured.status).toBe(303);
    expect(captured.location).toBe('https://www.yarnvia.online/order-success?status=unknown');
  });

  it('answers a server-to-server IPN with JSON, not a redirect', async () => {
    const captured = await post({ body: { ...CALLBACK }, headers: { accept: '*/*' } });

    expect(captured.status).toBe(200);
    expect(captured.location).toBeNull();
  });

  it('treats a fetch() from a page as machine traffic, not a navigation', async () => {
    const captured = await post({
      body: { ...CALLBACK },
      headers: { 'sec-fetch-dest': 'empty', accept: '*/*' },
    });

    expect(captured.status).toBe(200);
    expect(captured.location).toBeNull();
  });
});

// ─── One settlement behind every URL ────────────────────────────────────────

describe('the public and internal routes share one settlement', () => {
  it('keeps /api/payments/callback working', async () => {
    const captured = await invoke(await internalRoute(), { body: { ...CALLBACK } });

    expect(rows[0]?.payment_status).toBe('paid');
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  /*
   * The property that makes the compatibility route safe. If the two routes had
   * separate settlement implementations, the second delivery here could pay the
   * order a second time.
   */
  it('settles once even when the same callback reaches both routes', async () => {
    const viaPublic = await post({ body: { ...CALLBACK } });
    const viaInternal = await invoke(await internalRoute(), { body: { ...CALLBACK } });

    expect(transitions).toBe(1);
    expect(rows[0]?.payment_status).toBe('paid');
    expect(viaPublic.body).toEqual({ received: true, outcome: 'paid' });
    expect(viaInternal.body).toEqual({ received: true, outcome: 'already_settled' });
  });
});

/**
 * The routing that carries the public callback URL.
 *
 * This is not incidental: the original production failure was exactly this.
 * `/callback/cpm/arp/collection` fell through to the SPA catch-all and was
 * served by the static file server — a GET returned `index.html` and Airpay's
 * POST was answered `405` with an empty body — so nothing Airpay sent ever
 * reached a handler, and order YV-3200A-2AB47227 sat at `initiated`.
 *
 * The handler being correct is not enough if the request never arrives, and
 * rewrite ORDER is what decides that: Vercel takes the first match, so the two
 * callback rules must precede the catch-all. Reordering them would silently
 * restore the outage, which is why it is pinned here rather than left to
 * review.
 */
describe('vercel.json routes the public callback to this function', () => {
  const config = JSON.parse(
    readFileSync(new URL('../../../../vercel.json', import.meta.url), 'utf8'),
  ) as { rewrites: { source: string; destination: string }[] };

  const DESTINATION = '/api/callback/cpm/arp/collection';
  const CATCH_ALL = config.rewrites.findIndex((rule) => rule.destination === '/index.html');

  it.each(['/callback/cpm/arp/collection', '/callback/cpm/arp/collection/'])(
    'rewrites %s to the function, ahead of the SPA catch-all',
    (source) => {
      const index = config.rewrites.findIndex((rule) => rule.source === source);

      expect(index).toBeGreaterThanOrEqual(0);
      expect(config.rewrites[index].destination).toBe(DESTINATION);
      expect(index).toBeLessThan(CATCH_ALL);
    },
  );

  it('keeps an SPA catch-all that excludes the api namespace', () => {
    expect(CATCH_ALL).toBeGreaterThanOrEqual(0);
    // Without the negative lookahead the catch-all would swallow every
    // function route, not just this one.
    expect(config.rewrites[CATCH_ALL].source).toContain('(?!api/)');
  });
});
