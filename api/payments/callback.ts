import type { VercelRequest, VercelResponse } from '@vercel/node';

import { parseCallback } from '../_lib/callbackPayload';
import { methodNotAllowed, sendJson, withErrorHandling } from '../_lib/http';
import { log } from '../_lib/log';
import { settleOrder } from '../_lib/settle';

/**
 * POST /api/payments/callback — Airpay's server-to-server webhook.
 *
 * The path follows `docs/payment.md` §9 rather than the `/api/payments/airpay/…`
 * form sketched in the brief, since the plan is the approved specification and
 * this deployment has exactly one gateway.
 *
 * This endpoint is public, unauthenticated and reachable by anyone. It is
 * treated accordingly: the body is parsed as hostile input, and nothing in it
 * decides the outcome. Settlement runs entirely through `settleOrder`, which
 * re-verifies against Airpay before any order changes state.
 *
 * Deliberately indifferent to its caller. The client operates an existing
 * callback chain — `frontiva.online/callback/cpm/arp/collection` forwarding to
 * `kkchat.in/callback/cpm/arp/collection` — which Yarnvia does not build,
 * modify, or send anything to. This endpoint works identically whether it is
 * called by Airpay directly, by that relay, or not at all, because it derives
 * the outcome from Order Confirmation rather than from the request.
 *
 * That property is also why it needs no shared secret to be safe: a forged
 * request cannot produce a settlement it did not earn. If the client later
 * wants the relay to notify Yarnvia, pointing it here is sufficient and
 * requires no change on this side.
 *
 * Yarnvia does not depend on this endpoint firing. See `payments/reconcile.ts`
 * for the sweep that settles orders nobody ever reports.
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
