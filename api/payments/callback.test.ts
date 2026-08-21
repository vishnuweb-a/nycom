import type { VercelRequest, VercelResponse } from '@vercel/node';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Callback endpoint tests — settlement and the relay, together.
 *
 * The unit tests either side of this prove that settlement is correct and that
 * the relay honours its contract. What only an endpoint-level test can prove is
 * the relationship between them: that the relay is genuinely auxiliary.
 *
 * So the scenarios that matter here are the ones where KKChat misbehaves. A
 * timeout, a 500, a DNS failure — none of them may stop the order settling, and
 * none of them may change what Airpay is told, because Airpay retries anything
 * that is not a 200 and a retry storm helps nobody.
 */

const settleOrder = vi.fn();

vi.mock('../_lib/settle.js', () => ({
  settleOrder: (...args: unknown[]) => settleOrder(...args) as unknown,
}));

interface Captured {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

/** Minimal VercelResponse double capturing what the handler sent. */
const responseDouble = () => {
  const captured: Captured = { status: 0, body: null, headers: {} };

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
  };

  return { res: res as unknown as VercelResponse, captured };
};

const request = (body: unknown, method = 'POST'): VercelRequest =>
  ({ body, query: {}, method, headers: {} }) as VercelRequest;

/** A realistic Airpay success callback. */
const CALLBACK = {
  MERCID: '366751',
  TRANSACTIONID: 'YV-MB3K2-7F3A9C21',
  APTRANSACTIONID: 'AP99881',
  AMOUNT: '2.00',
  TRANSACTIONSTATUS: '200',
  MESSAGE: 'SUCCESS',
} as const;

/** Typed so `mockImplementation` is known to return a promise, not void. */
type FetchLike = (...args: unknown[]) => Promise<unknown>;

let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;

const handler = async () => (await import('./callback.js')).default;

const invoke = async (body: unknown, method = 'POST') => {
  const run = await handler();
  const { res, captured } = responseDouble();

  await run(request(body, method), res);

  return captured;
};

beforeEach(() => {
  vi.resetModules();
  delete process.env.KKCHAT_CALLBACK_URL;

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE = 'test-service-role';
  process.env.AIRPAY_MID = 'TESTMID';
  process.env.AIRPAY_CLIENT_ID = 'test-client-id';
  process.env.AIRPAY_API_KEY = 'test-api-key';
  process.env.AIRPAY_SECRET_KEY = 'test-secret';
  process.env.AIRPAY_USERNAME = 'test-user';
  process.env.AIRPAY_PASSWORD = 'test-pass';
  process.env.AIRPAY_ENV = 'live';

  settleOrder.mockReset();
  settleOrder.mockResolvedValue({ outcome: 'paid', orderRef: CALLBACK.TRANSACTIONID });

  fetchMock = vi.fn<FetchLike>().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);

  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/payments/callback', () => {
  it('settles the order and relays the callback onward', async () => {
    const captured = await invoke(CALLBACK);

    expect(settleOrder).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('forwards the Airpay fields verbatim as a JSON object', async () => {
    await invoke(CALLBACK);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const decoded = JSON.parse(init.body as string) as Record<string, string>;

    expect(decoded).toEqual(CALLBACK);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('settles before relaying, so the relay cannot precede the money', async () => {
    const order: string[] = [];

    settleOrder.mockImplementation(() => {
      order.push('settle');

      return Promise.resolve({ outcome: 'paid', orderRef: CALLBACK.TRANSACTIONID });
    });

    fetchMock.mockImplementation(() => {
      order.push('relay');

      return Promise.resolve({ ok: true, status: 200 });
    });

    await invoke(CALLBACK);

    expect(order).toEqual(['settle', 'relay']);
  });

  it('still settles and answers 200 when KKChat times out', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));

    const captured = await invoke(CALLBACK);

    expect(settleOrder).toHaveBeenCalledTimes(1);
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('still settles and answers 200 when KKChat returns 500', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const captured = await invoke(CALLBACK);

    expect(settleOrder).toHaveBeenCalledTimes(1);
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ received: true, outcome: 'paid' });
  });

  it('reports the settlement outcome, not the relay outcome', async () => {
    settleOrder.mockResolvedValue({ outcome: 'already_settled', orderRef: 'YV-1' });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const captured = await invoke(CALLBACK);

    expect(captured.body).toEqual({ received: true, outcome: 'already_settled' });
  });

  it('accepts a duplicate delivery without settling twice per request', async () => {
    settleOrder.mockResolvedValue({ outcome: 'already_settled', orderRef: 'YV-1' });

    const first = await invoke(CALLBACK);
    const second = await invoke(CALLBACK);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ received: true, outcome: 'already_settled' });
  });

  it('answers 200 to an unparseable body without settling or relaying', async () => {
    const captured = await invoke({ nothing: 'useful' });

    expect(settleOrder).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({ received: true });
  });

  it('rejects methods Airpay never uses', async () => {
    const captured = await invoke(CALLBACK, 'DELETE');

    expect(captured.status).toBe(405);
    expect(settleOrder).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not relay when forwarding is switched off', async () => {
    process.env.KKCHAT_CALLBACK_URL = 'off';

    const captured = await invoke(CALLBACK);

    expect(settleOrder).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(captured.status).toBe(200);
  });
});
