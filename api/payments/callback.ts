import type { VercelRequest, VercelResponse } from '@vercel/node';

import { processAirpayCallback } from '../_lib/callbackFlow.js';
import { methodNotAllowed, sendJson, withErrorHandling } from '../_lib/http.js';

/**
 * POST /api/payments/callback — the internal Airpay IPN endpoint.
 *
 * Airpay itself no longer calls this. Against MID 366950 the registered
 * Response and IPN URL is `/callback/cpm/arp/collection`, which
 * `api/callback/cpm/arp/collection.ts` serves. This path is kept because it is
 * a working, tested, externally-verified endpoint — a Postman run against it
 * already proved callback processing and KKChat forwarding end to end — and
 * because it remains the right destination if the MID is ever repointed.
 *
 * Both routes are transport adapters over the same `processAirpayCallback`
 * pipeline, so they cannot drift apart: there is one settlement, one relay, and
 * one place either could be changed.
 *
 * This endpoint is public, unauthenticated and reachable by anyone. It is
 * treated accordingly: the body is parsed as hostile input, and nothing in it
 * decides the outcome. Settlement runs entirely through `settleOrder`, which
 * re-verifies against Airpay's Order Confirmation API before any order changes
 * state. A callback is a prompt to go and check, never proof of payment.
 *
 * That property is also why no shared secret is required for this to be safe:
 * a forged request cannot produce a settlement it did not earn, because the
 * claim in the request is never what decides the result.
 *
 * Settlement does not depend on this endpoint firing at all. If an IPN is
 * delayed, dropped or never configured, `payments/reconcile.ts` and the success
 * page's polling reach the same verified outcome by a different route.
 *
 * Always answers 200. Airpay retries non-2xx responses, and a retry storm
 * against an endpoint that is working correctly — but reporting "I could not
 * settle this yet" — helps nobody. The outcome is carried in the body and the
 * logs, not the status code.
 */
const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  // Airpay posts. GET is accepted only because some configurations use it for
  // the same notification; the handling is identical.
  if (req.method !== 'POST' && req.method !== 'GET') {
    methodNotAllowed(res, ['POST', 'GET']);

    return;
  }

  const { parsed, settlement } = await processAirpayCallback(req, { leg: 'ipn', relay: true });

  if (parsed === null) {
    // 200 even here: an unparseable body will not become parseable on retry.
    sendJson(res, 200, { received: true });

    return;
  }

  sendJson(res, 200, { received: true, outcome: settlement?.outcome });
};

export default withErrorHandling('payment.callback', handler);
