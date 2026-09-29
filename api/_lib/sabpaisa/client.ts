import { log } from '../log.js';
import { sabpaisaEnv } from './env.js';

/**
 * The SabPaisa HTTP client.
 *
 * Two rules shape this module, and both are about not turning an uncertain
 * outcome into a confident wrong answer:
 *
 *  1. A network failure is its own outcome. It is never mapped onto FAILED or
 *     SUCCESS. Callers receive `kind: 'unreachable'` and must decide — and for
 *     a payment the only safe decision is "still unconfirmed".
 *
 *  2. Retries are for idempotent reads only. Transaction Enquiry may be
 *     retried; Create Payment may NOT, because a timed-out create may already
 *     have produced a payable session, and retrying it would create a second
 *     one for a single customer action.
 */

/** Wall-clock ceiling per attempt. Vercel functions have their own limit. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Bounded, and deliberately small. Enquiry is called on a user-facing path. */
const MAX_ENQUIRY_ATTEMPTS = 3;

/**
 * Cap on an honoured `Retry-After`.
 *
 * Deliberately short. Enquiry is called on the return leg, with a shopper's
 * browser waiting on the response, so a gateway asking us to back off for a day
 * — or for ten seconds — cannot be obeyed literally. Past this cap the attempt
 * is abandoned and the payment stays `unconfirmed`, which the reconciler picks
 * up. An honest "we are still confirming" beats a held-open request.
 */
const MAX_RETRY_AFTER_MS = 1_500;

export type SabPaisaResponse =
  | { readonly kind: 'ok'; readonly status: number; readonly body: unknown }
  /** A well-formed HTTP error. The gateway answered; the answer was a refusal. */
  | { readonly kind: 'http_error'; readonly status: number; readonly body: unknown }
  /**
   * No usable answer: DNS failure, TCP reset, TLS error, timeout, unparseable
   * body, or retries exhausted. Says nothing about whether money moved.
   */
  | { readonly kind: 'unreachable'; readonly reason: string };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Parses `Retry-After`, which may be delta-seconds or an HTTP date.
 *
 * Clamped into `[0, MAX_RETRY_AFTER_MS]`: SabPaisa asking us to wait an hour is
 * not something a request holding a shopper's browser open can honour, and an
 * absurd value must not become an absurd wait.
 */
const retryAfterMs = (header: string | null): number | null => {
  if (header === null || header.trim() === '') {
    return null;
  }

  const raw = header.trim();

  if (/^\d+$/.test(raw)) {
    return Math.min(Number(raw) * 1000, MAX_RETRY_AFTER_MS);
  }

  const date = Date.parse(raw);

  if (Number.isNaN(date)) {
    return null;
  }

  return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS);
};

/** One attempt. Never throws; every failure becomes a typed result. */
const attempt = async (
  path: string,
  body: unknown,
): Promise<{ readonly result: SabPaisaResponse; readonly retryAfter: number | null }> => {
  const env = sabpaisaEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.SABPAISA_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        // The credential. Present on the request and nowhere else — not in a
        // log, not in an error, not in a thrown message.
        'X-Api-Key': env.SABPAISA_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;

    try {
      parsed = text === '' ? null : JSON.parse(text);
    } catch {
      /*
       * A 2xx we cannot parse is unreachable, not ok: we have no status to act
       * on. The body is NOT logged — an error page from an intermediary can
       * echo request headers, and those carry the API key.
       */
      return {
        result: { kind: 'unreachable', reason: 'unparseable_response_body' },
        retryAfter: retryAfterMs(response.headers.get('retry-after')),
      };
    }

    const retryAfter = retryAfterMs(response.headers.get('retry-after'));

    if (response.ok) {
      return { result: { kind: 'ok', status: response.status, body: parsed }, retryAfter };
    }

    return { result: { kind: 'http_error', status: response.status, body: parsed }, retryAfter };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';

    return {
      result: { kind: 'unreachable', reason: aborted ? 'timeout' : 'network_error' },
      retryAfter: null,
    };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * A single, NON-RETRIED request. For Create Payment.
 *
 * The absence of a retry here is the point. An unknown create outcome must be
 * resolved by asking Transaction Enquiry about the `merchantTxnId` we already
 * minted — never by sending another create.
 */
export const postOnce = async (path: string, body: unknown): Promise<SabPaisaResponse> =>
  (await attempt(path, body)).result;

/**
 * A retried request, for IDEMPOTENT server-to-server reads only.
 *
 * Retries only on 429, 5xx and unreachable — never on a 4xx, which is a
 * deterministic refusal that a second identical request will earn again.
 * Backoff is exponential, and an explicit `Retry-After` overrides it.
 */
export const postWithRetry = async (
  path: string,
  body: unknown,
  event: string,
): Promise<SabPaisaResponse> => {
  let last: SabPaisaResponse = { kind: 'unreachable', reason: 'no_attempt' };

  for (let index = 0; index < MAX_ENQUIRY_ATTEMPTS; index += 1) {
    const { result, retryAfter } = await attempt(path, body);

    last = result;

    const retryable =
      result.kind === 'unreachable' ||
      (result.kind === 'http_error' && (result.status === 429 || result.status >= 500));

    if (!retryable) {
      return result;
    }

    if (index < MAX_ENQUIRY_ATTEMPTS - 1) {
      const backoff = retryAfter ?? 250 * 2 ** index;

      log.warn(`${event}.retrying`, {
        attempt: index + 1,
        // Status only; the body may echo our own request headers.
        status: result.kind === 'http_error' ? result.status : null,
        reason: result.kind === 'unreachable' ? result.reason : null,
        backoffMs: backoff,
      });

      await sleep(backoff);
    }
  }

  return last;
};
