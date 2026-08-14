import type { VercelRequest, VercelResponse } from '@vercel/node';

import { parseCallback } from '../_lib/callbackPayload.js';
import { methodNotAllowed, sendJson, withErrorHandling } from '../_lib/http.js';
import { log } from '../_lib/log.js';
import { settleOrder } from '../_lib/settle.js';

/**
 * POST /api/payments/callback — Yarnvia's own Airpay IPN endpoint.
 *
 * This is the URL to register as the IPN/callback destination for Yarnvia's
 * Airpay MID. Airpay posts here directly, server to server; nothing relays,
 * proxies or forwards on Yarnvia's behalf, and this endpoint reaches out to
 * nobody. The integration is self-contained.
 *
 * The path follows `docs/payment.md` §9 rather than the `/api/payments/airpay/…`
 * form sketched in the brief, since the plan is the approved specification and
 * this deployment has exactly one gateway.
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

  const payload = parseCallback(req);

  if (payload === null) {
    log.warn('payment.callback.unparseable', { method: req.method ?? 'unknown' });

    // 200 even here: an unparseable body will not become parseable on retry.
    sendJson(res, 200, { received: true });

    return;
  }

  const result = await settleOrder(payload);

  sendJson(res, 200, { received: true, outcome: result.outcome });
};

export default withErrorHandling('payment.callback', handler);
