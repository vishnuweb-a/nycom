import { errorMessage, log } from './log.js';

/**
 * Outbound callback relay to the client's existing KKChat endpoint.
 *
 * This reproduces the forwarding behaviour established by the Frontiva
 * integration: an Airpay callback that lands here is passed on, unchanged, to
 * the merchant's existing collection endpoint so their reconciliation continues
 * to see the same events it always has.
 *
 * ── The one rule this module exists to enforce ──────────────────────────────
 *
 * The relay is AUXILIARY. Notifying KKChat is not part of taking a payment, and
 * nothing here may influence whether an order settles. Every failure mode —
 * DNS, TLS, timeout, connection reset, 4xx, 5xx, an HTML error page — resolves
 * to "log it and carry on". `forwardCallback` does not throw, does not retry,
 * and does not return a value the caller is expected to branch on.
 *
 * Settlement has already happened by the time this runs (see
 * `api/payments/callback.ts`), so even a total outage at the destination cannot
 * reorder, delay past its timeout, or roll back a verified payment.
 */

/**
 * The established destination, from the original integration brief recorded in
 * `docs/payment.md` §11: "forward all callback data received at
 * frontiva.online/… to our existing callback endpoint kkchat.in/…".
 *
 * This value is deliberately not invented and not derived. It is the endpoint
 * the previous integration already posted to, and it is kept byte-for-byte.
 * `KKCHAT_CALLBACK_URL` overrides it only if the merchant moves the endpoint.
 */
const DEFAULT_DESTINATION = 'https://kkchat.in/callback/cpm/arp/collection';

/**
 * Short, and deliberately shorter than the gateway timeouts in `airpay.ts`.
 *
 * Settlement is already complete when this fires, so every millisecond spent
 * here is pure added latency on the response Airpay is waiting for. Airpay
 * retries slow or failed callbacks, and a relay that drags the function towards
 * the platform's 10s ceiling would manufacture exactly the retry storm the
 * always-200 policy exists to avoid.
 */
const RELAY_TIMEOUT_MS = 5_000;

/**
 * Bounds on what may be forwarded.
 *
 * The inbound callback endpoint is public and unauthenticated, which means
 * anyone can cause an outbound POST to the destination. That is acceptable for
 * a genuine Airpay payload — a dozen short fields — but it must not become a
 * way to push arbitrary bulk content through Yarnvia at a third party.
 *
 * These caps are sized far above any real Airpay callback, so a legitimate
 * payload passes through untouched and only abuse is trimmed.
 */
const MAX_FIELDS = 64;
const MAX_VALUE_LENGTH = 1_024;

/**
 * Resolves the destination, or `null` when forwarding is switched off.
 *
 * Read from `process.env` directly rather than through `serverEnv()`: the relay
 * must stay decoupled from the payment credential schema, so a misconfiguration
 * on either side cannot take the other down.
 */
const destination = (): string | null => {
  const configured = process.env.KKCHAT_CALLBACK_URL?.trim();

  if (configured === undefined || configured === '') {
    return DEFAULT_DESTINATION;
  }

  // An explicit opt-out, for a deployment that must not relay at all.
  if (configured.toLowerCase() === 'off' || configured.toLowerCase() === 'disabled') {
    return null;
  }

  return configured;
};

/** Applies the abuse bounds. Genuine Airpay payloads are unaffected. */
const bound = (fields: Readonly<Record<string, string>>): Record<string, string> => {
  const bounded: Record<string, string> = {};

  for (const [key, value] of Object.entries(fields).slice(0, MAX_FIELDS)) {
    bounded[key] = value.length > MAX_VALUE_LENGTH ? value.slice(0, MAX_VALUE_LENGTH) : value;
  }

  return bounded;
};

/**
 * Forwards an Airpay callback to the KKChat endpoint.
 *
 * The contract, unchanged from the previous integration:
 *
 *   POST
 *   Content-Type: application/json
 *   Accept:       application/json
 *   Body:         a JSON OBJECT of the Airpay fields
 *
 * Not form-urlencoded, not query parameters, and not a JSON string containing
 * JSON. `JSON.stringify` is applied to the record exactly once, so the body is
 * `{"MERCID":"366751","TRANSACTIONSTATUS":"200",…}` rather than a quoted,
 * escaped string of the same thing — a distinction the receiving end parses
 * very differently.
 *
 * Values arrive as strings and stay strings. Nothing is re-encrypted, renamed,
 * re-cased, coerced to a number, or dropped.
 *
 * Never throws. Callers may `await` it purely to keep the request alive on a
 * serverless runtime that would otherwise freeze the instance at response time.
 */
export const forwardCallback = async (
  fields: Readonly<Record<string, string>>,
  orderRef: string,
): Promise<void> => {
  const url = destination();

  if (url === null) {
    return;
  }

  const body = bound(fields);

  // Field names only — never the values. A callback carries a customer VPA and
  // gateway messages, and this line goes to a shared log sink.
  log.info('payment.callback.forward.start', {
    orderRef,
    destination: url,
    fieldCount: Object.keys(body).length,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, RELAY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      // A non-2xx is the destination's problem to fix, not a payment failure.
      // Logged and dropped: no retry, because Airpay will re-deliver the
      // callback on its own schedule if it did not get a 200 from us, and
      // retrying here would multiply that.
      log.warn('payment.callback.forward.rejected', {
        orderRef,
        destination: url,
        status: response.status,
      });

      return;
    }

    log.info('payment.callback.forward.success', {
      orderRef,
      destination: url,
      status: response.status,
    });
  } catch (error) {
    // Covers the timeout abort, DNS failure, TLS failure and connection reset.
    // All of them mean the same thing here: KKChat was not notified, and the
    // payment is entirely unaffected.
    log.warn('payment.callback.forward.failed', {
      orderRef,
      destination: url,
      reason: errorMessage(error),
    });
  } finally {
    clearTimeout(timer);
  }
};
