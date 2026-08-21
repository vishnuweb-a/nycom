import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  processAirpayCallback,
  redirectBrowser,
  successPageLocation,
} from '../_lib/callbackFlow.js';
import { withErrorHandling } from '../_lib/http.js';
import { log } from '../_lib/log.js';

/**
 * GET|POST /api/payments/return — the internal browser-return endpoint.
 *
 * As with `callback.ts`, Airpay no longer sends anything here: against MID
 * 366950 the browser is handed back to `/callback/cpm/arp/collection`, served
 * by `api/callback/cpm/arp/collection.ts`. This path is kept working for any
 * client or deployment still pointing at it, and shares the same pipeline, so
 * the two cannot diverge.
 *
 * This is a navigation endpoint, not an API: it redirects into the SPA. It runs
 * the same settlement as the webhook, because the two race and either may
 * arrive first, and `settleOrder` is safe to call twice.
 *
 * What it must never do is tell the customer they have paid because they
 * arrived here. A redirect proves only that a browser was pointed at a URL —
 * anyone can type one. The redirect target carries the order reference and its
 * opaque read key; the success page then asks the server what actually
 * happened.
 *
 * It does not relay to KKChat. That has always been the callback leg's job, and
 * the public `/callback/…` route now covers the browser leg too, so starting to
 * relay here would only add a third copy of the same event.
 */
const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  const { parsed, settlement } = await processAirpayCallback(req, {
    leg: 'return',
    relay: false,
  });

  const orderRef = parsed?.payload.orderRef ?? null;

  log.info('payment.return.handled', {
    orderRef,
    outcome: settlement?.outcome ?? null,
  });

  redirectBrowser(res, await successPageLocation(req, orderRef));
};

export default withErrorHandling('payment.return', handler);
