import type { VercelRequest, VercelResponse } from '@vercel/node';

import { parseCallback } from '../_lib/callbackPayload';
import { db } from '../_lib/db';
import { withErrorHandling } from '../_lib/http';
import { log } from '../_lib/log';
import { settleOrder } from '../_lib/settle';

/**
 * GET|POST /api/payments/return — where Airpay sends the customer's browser.
 *
 * This is a navigation endpoint, not an API: it redirects into the SPA. It runs
 * the same settlement as the webhook, because the two race and either may
 * arrive first, and `settleOrder` is safe to call twice.
 *
 * What it must never do is tell the customer they have paid because they
 * arrived here. A redirect proves only that a browser was pointed at a URL —
 * anyone can type it. The redirect target carries the order reference and its
 * opaque read key; the success page then asks the server what actually
 * happened.
 */

/** Where to send the browser. Falls back to the deployment's own host. */
const siteOrigin = (req: VercelRequest): string => {
  const configured = process.env.PUBLIC_SITE_ORIGIN;

  if (configured !== undefined && configured !== '') {
    return configured.replace(/\/$/, '');
  }

  // `x-forwarded-host` is set by Vercel's proxy. Used only to build a relative
  // redirect back to this same deployment, never as a trust signal.
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const resolved = Array.isArray(host) ? host[0] : host;

  return resolved === undefined ? '' : `https://${resolved}`;
};

const redirect = (res: VercelResponse, location: string): void => {
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(303, location);
};

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  const origin = siteOrigin(req);
  const payload = parseCallback(req);

  if (payload === null) {
    log.warn('payment.return.unparseable', { method: req.method ?? 'unknown' });

    redirect(res, `${origin}/order-success?status=unknown`);

    return;
  }

  const result = await settleOrder(payload);

  // The read key is looked up server-side rather than accepted from the query
  // string, so a crafted return URL cannot hand someone else's token back.
  const { data } = await db()
    .from('orders')
    .select('access_token')
    .eq('order_ref', payload.orderRef)
    .maybeSingle();

  const accessToken = (data as { access_token?: string } | null)?.access_token;

  if (accessToken === undefined) {
    redirect(res, `${origin}/order-success?status=unknown`);

    return;
  }

  const target = new URL(`${origin}/order-success`);

  target.searchParams.set('ref', payload.orderRef);
  target.searchParams.set('t', accessToken);

  log.info('payment.return.handled', { orderRef: payload.orderRef, outcome: result.outcome });

  redirect(res, target.toString());
};

export default withErrorHandling('payment.return', handler);
