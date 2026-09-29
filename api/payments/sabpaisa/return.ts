import type { VercelRequest, VercelResponse } from '@vercel/node';

import { db } from '../../_lib/db.js';
import { withErrorHandling } from '../../_lib/http.js';
import { log } from '../../_lib/log.js';
import { parseReturnRupeesToPaise } from '../../_lib/sabpaisa/amount.js';
import {
  RETURN_SIGNED_PARAMS,
  verifyReturnSignature,
  type ReturnSignedParam,
} from '../../_lib/sabpaisa/crypto.js';
import { sabpaisaEnv } from '../../_lib/sabpaisa/env.js';
import { settleSabPaisaPayment } from '../../_lib/sabpaisa/settle.js';

/**
 * GET|POST /api/payments/sabpaisa/return — the browser return endpoint.
 *
 * This is a navigation endpoint, not an API: it redirects into the SPA. It
 * fails closed at every step, and the order of the steps is load-bearing:
 *
 *   verify HMAC return signature
 *        ↓
 *   load the locally stored payment session
 *        ↓
 *   Transaction Enquiry (server-to-server)
 *        ↓
 *   verify amount / reference / currency
 *        ↓
 *   SUCCESS
 *
 * What it must never do is tell the customer they have paid because they
 * arrived here. A redirect proves only that a browser was pointed at a URL —
 * anyone can type one. A *signed* redirect proves the parameters are authentic,
 * which is a real guarantee and still not proof of payment: it is permission to
 * go and ask Transaction Enquiry, which is the only authority.
 *
 * It does not relay to KKChat. That is the Airpay callback leg's job, and a
 * SabPaisa payment has no business reaching it.
 */

/** Reads a query or form field as a single string. */
const field = (req: VercelRequest, name: string): string | undefined => {
  const fromQuery = req.query[name];
  const picked = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;

  if (typeof picked === 'string' && picked !== '') {
    return picked;
  }

  // SabPaisa may return by form POST; the platform parses that into `body`.
  const body: unknown = req.body;

  if (typeof body === 'object' && body !== null) {
    const value = (body as Record<string, unknown>)[name];

    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }

  return undefined;
};

/** Where to send a shopper we cannot identify or verify. */
const unknownLocation = (): string =>
  `${sabpaisaEnv().PUBLIC_SITE_ORIGIN.replace(/\/$/, '')}/order-success?status=unknown`;

/**
 * Builds the confirmation-page target.
 *
 * Carries the order reference and its opaque read key, and DELIBERATELY NO
 * claim about the outcome — no `status=SUCCESS`, no amount, no payment id. The
 * success page then asks the server what actually happened. The read key is
 * looked up server-side from the order row rather than taken from the request,
 * so a crafted return URL cannot hand someone else's token back.
 */
const successPageLocation = async (orderRef: string | null): Promise<string> => {
  if (orderRef === null) {
    return unknownLocation();
  }

  const { data } = await db()
    .from('orders')
    .select('access_token')
    .eq('order_ref', orderRef)
    .maybeSingle();

  const accessToken = (data as { access_token?: string } | null)?.access_token;

  if (accessToken === undefined) {
    return unknownLocation();
  }

  const query = new URLSearchParams({ ref: orderRef, t: accessToken });

  return `${sabpaisaEnv().PUBLIC_SITE_ORIGIN.replace(/\/$/, '')}/order-success?${query.toString()}`;
};

/** Sends the browser onward. 303, so a POSTed return becomes a GET. */
const redirect = (res: VercelResponse, location: string): void => {
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(303, location);
};

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  // ── Step 1: the signature. Nothing proceeds without it. ──
  const signature = field(req, 'signature');
  const signed: Partial<Record<ReturnSignedParam, string>> = {};

  for (const name of RETURN_SIGNED_PARAMS) {
    signed[name] = field(req, name);
  }

  const missing = RETURN_SIGNED_PARAMS.filter((name) => signed[name] === undefined);

  /*
   * A return missing any signed parameter cannot be verified, so it is refused
   * outright. Signing over a partial set — treating an absent value as `''` —
   * would let an attacker drop a parameter and still produce a valid signature
   * over what remained.
   */
  if (signature === undefined || missing.length > 0) {
    log.warn('sabpaisa.return.incomplete', {
      hasSignature: signature !== undefined,
      missingFields: missing.join(','),
    });

    redirect(res, unknownLocation());

    return;
  }

  const params = signed as Record<ReturnSignedParam, string>;

  if (!verifyReturnSignature(params, signature)) {
    /*
     * Invalid signature: NO SUCCESS, NO FULFILMENT, NO CART CLEARING.
     *
     * Note what does NOT happen here — the payment session is not touched. An
     * unauthenticated request must not be able to move a real payment into a
     * failed state, or anyone could cancel a stranger's order by guessing a
     * reference. The reconciler, which trusts only Transaction Enquiry, remains
     * the path by which this payment reaches a verdict.
     */
    log.error('sabpaisa.return.invalid_signature', {
      merchantTxnId: params.merchant_txn_id,
    });

    redirect(res, unknownLocation());

    return;
  }

  const merchantTxnId = params.merchant_txn_id;

  log.info('sabpaisa.return.verified', {
    merchantTxnId,
    // SabPaisa's claimed status. Recorded, never believed.
    claimedStatus: params.status,
    paymentMode: params.payment_mode,
  });

  /*
   * ── Steps 2–4: the local record, then Transaction Enquiry, then the
   * cross-check. All three live in `settleSabPaisaPayment`, which is the single
   * place a SabPaisa payment may be marked paid.
   *
   * `paid_amount` arrives here in RUPEES and is converted to paise before it is
   * compared with anything. It is passed only so a contradiction between the
   * two SabPaisa channels can be flagged; it cannot by itself produce a `paid`.
   */
  const settlement = await settleSabPaisaPayment(merchantTxnId, {
    status: params.status.toUpperCase(),
    paidAmountPaise: parseReturnRupeesToPaise(params.paid_amount),
  });

  log.info('sabpaisa.return.settled', {
    merchantTxnId,
    orderRef: settlement.orderRef,
    outcome: settlement.outcome,
  });

  redirect(res, await successPageLocation(settlement.orderRef));
};

export default withErrorHandling('sabpaisa.payment.return', handler);
