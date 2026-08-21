import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Callback relay tests.
 *
 * Two things are being proved here, and they are of different kinds.
 *
 * The first is the wire contract with KKChat: POST, `application/json`, and a
 * body that is a JSON *object* of the Airpay fields — not form data, not query
 * parameters, and not a JSON string containing JSON. That last distinction has
 * broken this integration before and is asserted explicitly below.
 *
 * The second is that the relay is auxiliary. Every failure the network can
 * produce must resolve to a logged no-op, because a KKChat outage must never be
 * able to reach back and disturb a settled payment.
 */

const DEFAULT_DESTINATION = 'https://kkchat.in/callback/cpm/arp/collection';

/** A realistic Airpay callback, in the casing Airpay actually sends. */
const AIRPAY_FIELDS = {
  MERCID: '366751',
  TRANSACTIONSTATUS: '200',
  TRANSACTIONID: 'YV-MB3K2-7F3A9C21',
  APTRANSACTIONID: 'AP99881',
  AMOUNT: '2.00',
  MESSAGE: 'SUCCESS',
  CUSTOMERVPA: 'shopper@upi',
  ap_SecureHash: '2748109351',
} as const;

let fetchMock: ReturnType<typeof vi.fn>;

const relay = async () => (await import('./relay.js')).forwardCallback;

/** The single `fetch` call the relay made, as [url, init]. */
const sentRequest = () => {
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

  return { url, init };
};

beforeEach(() => {
  vi.resetModules();
  delete process.env.KKCHAT_CALLBACK_URL;

  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);

  // The relay logs on every path; silence it rather than assert on console.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('forwardCallback — destination', () => {
  it('posts to the established KKChat endpoint by default', async () => {
    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-MB3K2-7F3A9C21');

    expect(sentRequest().url).toBe(DEFAULT_DESTINATION);
  });

  it('honours an explicit KKCHAT_CALLBACK_URL override', async () => {
    process.env.KKCHAT_CALLBACK_URL = 'https://staging.example.test/collect';

    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    expect(sentRequest().url).toBe('https://staging.example.test/collect');
  });

  it('falls back to the established endpoint when the override is blank', async () => {
    process.env.KKCHAT_CALLBACK_URL = '   ';

    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    expect(sentRequest().url).toBe(DEFAULT_DESTINATION);
  });

  it('sends nothing at all when relaying is switched off', async () => {
    process.env.KKCHAT_CALLBACK_URL = 'off';

    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('forwardCallback — the outbound contract', () => {
  it('uses POST with JSON content-type and accept headers', async () => {
    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    const { init } = sentRequest();
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe('POST');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/json');
  });

  it('sends a JSON object, not a JSON string containing JSON', async () => {
    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    const body = sentRequest().init.body as string;

    // Double-encoding would make this a string; the contract requires an object.
    const decoded: unknown = JSON.parse(body);

    expect(typeof decoded).toBe('object');
    expect(decoded).not.toBeNull();
    expect(Array.isArray(decoded)).toBe(false);

    // The tell-tale of the double-encoded bug: a body starting with a quote.
    expect(body.startsWith('{')).toBe(true);
    expect(body.startsWith('"')).toBe(false);
  });

  it('preserves every field, its casing, and its string type', async () => {
    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    const decoded = JSON.parse(sentRequest().init.body as string) as Record<string, unknown>;

    expect(decoded).toEqual(AIRPAY_FIELDS);

    // Numeric-looking values must not have been coerced to numbers.
    expect(decoded.TRANSACTIONSTATUS).toBe('200');
    expect(decoded.AMOUNT).toBe('2.00');
    expect(typeof decoded.AMOUNT).toBe('string');
  });

  it('does not send the payload as form data or query parameters', async () => {
    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    const { url, init } = sentRequest();

    expect(url).not.toContain('?');
    expect(init.body).not.toBeInstanceOf(URLSearchParams);
    expect(typeof init.body).toBe('string');
    expect(init.body as string).not.toContain('MERCID=366751');
  });
});

describe('forwardCallback — failures never touch the payment', () => {
  it('resolves quietly when KKChat times out or the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));

    const forwardCallback = await relay();

    await expect(forwardCallback(AIRPAY_FIELDS, 'YV-1')).resolves.toBeUndefined();
  });

  it('resolves quietly on a non-2xx response and does not retry', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const forwardCallback = await relay();

    await expect(forwardCallback(AIRPAY_FIELDS, 'YV-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 4xx either', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes an abort signal so a hung destination cannot hold the function', async () => {
    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    expect(sentRequest().init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('forwardCallback — abuse bounds', () => {
  it('caps an implausibly large field count', async () => {
    const flood: Record<string, string> = {};

    for (let index = 0; index < 200; index += 1) {
      flood[`FIELD_${index}`] = 'x';
    }

    const forwardCallback = await relay();

    await forwardCallback(flood, 'YV-1');

    const decoded = JSON.parse(sentRequest().init.body as string) as Record<string, string>;

    expect(Object.keys(decoded)).toHaveLength(64);
  });

  it('leaves a genuine Airpay payload completely untouched', async () => {
    const forwardCallback = await relay();

    await forwardCallback(AIRPAY_FIELDS, 'YV-1');

    const decoded = JSON.parse(sentRequest().init.body as string) as Record<string, string>;

    expect(decoded).toEqual(AIRPAY_FIELDS);
  });
});
