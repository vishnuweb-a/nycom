import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { postOnce as PostOnceFn, postWithRetry as PostWithRetryFn } from './client.js';
import { resetSabPaisaEnvCache } from './env.js';

/**
 * Retry and rate-limit behaviour.
 *
 * `fetch` is replaced with a stub for every case, so no request leaves the
 * machine. The distinction under test is the one that decides whether a
 * customer can be charged twice:
 *
 *   postOnce      — never retried. For Create Payment.
 *   postWithRetry — bounded retries. For Transaction Enquiry only.
 */

const fetchMock = vi.fn();

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as Response;

let postOnce: typeof PostOnceFn;
let postWithRetry: typeof PostWithRetryFn;

beforeEach(async () => {
  process.env.SABPAISA_CLIENT_CODE = 'TESTCC';
  process.env.SABPAISA_MERCHANT_ID = 'TESTMI';
  process.env.SABPAISA_API_KEY = 'test-api-key';
  process.env.SABPAISA_SECRET_KEY = 'test-secret-key';
  process.env.SABPAISA_BASE_URL = 'https://merchant-api.sabpaisa.in';
  process.env.PUBLIC_SITE_ORIGIN = 'https://www.yarnvia.online';
  resetSabPaisaEnvCache();

  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);

  ({ postOnce, postWithRetry } = await import('./client.js'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSabPaisaEnvCache();
});

describe('postOnce (Create Payment)', () => {
  it('sends the API key as X-Api-Key and never in the body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { paymentId: 'p1' }));

    await postOnce('/api/v2/payments', { merchantTxnId: 'YVSP-1' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = typeof init.body === 'string' ? init.body : '';

    expect(url).toBe('https://merchant-api.sabpaisa.in/api/v2/payments');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('test-api-key');
    expect(body).not.toContain('test-api-key');
    expect(body).toContain('YVSP-1');
  });

  it('NEVER retries — a second create could charge the customer twice', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: 'unavailable' }));

    const result = await postOnce('/api/v2/payments', {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('http_error');
  });

  it('reports a network failure as unreachable, not as a refusal', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const result = await postOnce('/api/v2/payments', {});

    expect(result).toEqual({ kind: 'unreachable', reason: 'network_error' });
  });

  it('reports a timeout as unreachable', async () => {
    const aborted = new Error('aborted');

    aborted.name = 'AbortError';
    fetchMock.mockRejectedValue(aborted);

    const result = await postOnce('/api/v2/payments', {});

    expect(result).toEqual({ kind: 'unreachable', reason: 'timeout' });
  });

  it('treats an unparseable 2xx as unreachable rather than success', async () => {
    // A 2xx whose body is an HTML error page from an intermediary, not JSON.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve('<html>gateway error</html>'),
    });

    const result = await postOnce('/api/v2/payments', {});

    expect(result.kind).toBe('unreachable');
  });
});

describe('postWithRetry (Transaction Enquiry)', () => {
  it('returns a successful first response without retrying', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'SUCCESS' }));

    const result = await postWithRetry('/api/v2/payments/enquiry', {}, 'test');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'ok', status: 200, body: { status: 'SUCCESS' } });
  });

  it('retries a 429 and honours Retry-After', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { error: 'rate_limited' }, { 'retry-after': '1' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'SUCCESS' }));

    const result = await postWithRetry('/api/v2/payments/enquiry', {}, 'test');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe('ok');
  });

  it('retries a 5xx', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(502, {}))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'SUCCESS' }));

    expect((await postWithRetry('/api/v2/payments/enquiry', {}, 'test')).kind).toBe('ok');
  });

  it('does NOT retry a 4xx, which a second identical request would earn again', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'bad_request' }));

    const result = await postWithRetry('/api/v2/payments/enquiry', {}, 'test');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('http_error');
  });

  it('gives up after a bounded number of attempts', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const result = await postWithRetry('/api/v2/payments/enquiry', {}, 'test');

    // Bounded: it must not retry forever on a user-facing path.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.kind).toBe('unreachable');
  });

  it('does not wait on an absurd Retry-After', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '86400' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'SUCCESS' }));

    const started = Date.now();

    await postWithRetry('/api/v2/payments/enquiry', {}, 'test');

    // Clamped, so a hostile or mistaken header cannot hang the request while a
    // shopper's browser waits on the return leg.
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});
