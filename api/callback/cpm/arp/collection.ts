import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  isBrowserNavigation,
  processAirpayCallback,
  redirectBrowser,
  successPageLocation,
} from '../../../_lib/callbackFlow.js';
import { methodNotAllowed, sendJson, withErrorHandling } from '../../../_lib/http.js';
import { log } from '../../../_lib/log.js';

/**
 * POST|GET /callback/cpm/arp/collection — the URL Airpay actually calls.
 *
 * ── Why this path exists ────────────────────────────────────────────────────
 *
 * Airpay resolves the Response URL and the IPN URL per merchant ID, from the
 * dashboard, not from anything sent at transaction time. Against MID 366950
 * both are registered as:
 *
 *     https://www.yarnvia.online/callback/cpm/arp/collection
 *
 * The code assumed `/api/payments/callback` and `/api/payments/return`, so
 * nothing Airpay sent ever reached a handler. `/callback/…` fell through the
 * SPA catch-all rewrite in `vercel.json` and was served by the static file
 * server: a GET returned `index.html`, and Airpay's POST was answered `405
 * Method Not Allowed` with an empty body. Order `YV-3200A-2AB47227` — a real,
 * successful ₹81 UPI payment, Airpay transaction 2051234202 — is still sitting
 * at `payment_status = initiated` because of exactly that.
 *
 * The dashboard is not ours to change, so the application moves to meet it.
 *
 * ── What this file is, and is not ───────────────────────────────────────────
 *
 * It is a transport adapter. It contains no settlement, no verification, no
 * relay and no order logic. All of that lives in `_lib/callbackFlow.ts`, which
 * `api/payments/callback.ts` and `api/payments/return.ts` also call, so there
 * is exactly one settlement implementation behind all three URLs.
 *
 * `vercel.json` rewrites the public path onto this function in-place. No HTTP
 * request is made from Yarnvia to itself: one invocation, one settlement.
 *
 * ── One URL, two kinds of caller ────────────────────────────────────────────
 *
 * Airpay points both the browser and its own IPN daemon here. Both are settled
 * identically and unconditionally — the shape of the *reply* is the only thing
 * that differs:
 *
 *   • a browser gets a 303 to the order-success page;
 *   • a machine gets `200 {"received": true, …}`.
 *
 * The browser leg therefore cannot bypass server-side verification. It has
 * already been through `settleOrder` — which re-checks with Airpay's Order
 * Confirmation API before any order changes state — before this file decides
 * how to answer. Spoofing `Sec-Fetch-Dest` changes which response you get and
 * nothing whatsoever about whether an order is paid.
 *
 * Always answers 2xx to a machine. Airpay retries non-2xx responses, and a
 * retry storm against an endpoint that is working correctly — but reporting "I
 * could not settle this yet" — helps nobody. The outcome is carried in the body
 * and the logs, not the status code.
 */
const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  // Airpay posts. GET is accepted because the return leg may arrive as a
  // navigation with the fields in the query string.
  if (req.method !== 'POST' && req.method !== 'GET') {
    methodNotAllowed(res, ['POST', 'GET']);

    return;
  }

  const browser = isBrowserNavigation(req);

  /*
   * Relayed on both legs, deliberately.
   *
   * Under the previous integration `kkchat.in/callback/cpm/arp/collection` was
   * itself registered as the Response *and* IPN URL, so KKChat already saw both
   * deliveries for a payment. Forwarding both reproduces what it has always
   * received. The alternative — relaying only traffic we classify as an IPN —
   * fails silently and completely in the case where Airpay sends the browser
   * leg alone, which is the worse of the two failure modes by a wide margin.
   */
  const { parsed, settlement } = await processAirpayCallback(req, {
    leg: browser ? 'browser' : 'ipn',
    relay: true,
  });

  if (browser) {
    const location = await successPageLocation(req, parsed?.payload.orderRef ?? null);

    log.info('payment.callback.browser_return', {
      orderRef: parsed?.payload.orderRef ?? null,
      outcome: settlement?.outcome ?? null,
    });

    redirectBrowser(res, location);

    return;
  }

  if (parsed === null) {
    // 200 even here: an unparseable body will not become parseable on retry.
    sendJson(res, 200, { received: true });

    return;
  }

  sendJson(res, 200, { received: true, outcome: settlement?.outcome });
};

export default withErrorHandling('payment.callback', handler);
