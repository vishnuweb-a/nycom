import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';

import { db } from '../_lib/db';
import { methodNotAllowed, PublicError, sendJson, withErrorHandling } from '../_lib/http';
import { settleOrder } from '../_lib/settle';

/**
 * GET /api/orders/:ref?t=<access_token> — authoritative payment status.
 *
 * The success page polls this instead of believing the redirect that brought it
 * there. It is the answer to "did this actually get paid?", and it comes from
 * the row that only server-side verification can write.
 *
 * Access is by the opaque per-order token minted at checkout, compared in
 * constant time. The order reference alone is not enough: references appear in
 * the Airpay dashboard and in URLs, and an order row holds a shipping address.
 *
 * The response is deliberately thin — status, amount, and the few facts the
 * confirmation screen renders. No address, no gateway detail, no internal ids.
 */

interface OrderRow {
  readonly order_ref: string;
  readonly access_token: string;
  readonly status: string;
  readonly payment_status: string;
  readonly payment_method: string;
  readonly amount: number;
  readonly currency: string;
  readonly created_at: string;
}

/**
 * States from which no further automatic transition is possible.
 *
 * `requires_review` counts as settled for polling purposes: the shopper should
 * stop seeing a spinner, even though the order is not finished — it is waiting
 * on a human, and no amount of polling will change it.
 */
const SETTLED = new Set(['paid', 'failed', 'cancelled', 'requires_review']);

/** Constant-time comparison, so response timing cannot leak the token. */
const tokensMatch = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
};

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);

    return;
  }

  const ref = Array.isArray(req.query.ref) ? req.query.ref[0] : req.query.ref;
  const token = Array.isArray(req.query.t) ? req.query.t[0] : req.query.t;

  if (typeof ref !== 'string' || ref === '' || typeof token !== 'string' || token === '') {
    throw new PublicError(400, 'invalid_request', 'We could not find that order.');
  }

  const { data, error } = await db()
    .from('orders')
    .select(
      'order_ref, access_token, status, payment_status, payment_method, amount, currency, created_at',
    )
    .eq('order_ref', ref)
    .maybeSingle();

  // One indistinguishable response for "no such order" and "wrong token", so
  // this endpoint cannot be used to discover which references exist.
  if (error !== null || data === null) {
    throw new PublicError(404, 'not_found', 'We could not find that order.');
  }

  const order = data as unknown as OrderRow;

  if (!tokensMatch(token, order.access_token)) {
    throw new PublicError(404, 'not_found', 'We could not find that order.');
  }

  let paymentStatus = order.payment_status;

  /*
   * Self-healing poll. If the webhook never arrived — a common outcome when the
   * gateway cannot reach the deployment, or during a retry gap — the shopper
   * sitting on the success page drives verification themselves. `settleOrder`
   * still does the full Order Confirmation check, so this is not a shortcut:
   * it is the same trusted path, triggered by a different event.
   */
  if (!SETTLED.has(paymentStatus) && order.payment_method === 'airpay') {
    const result = await settleOrder({
      orderRef: order.order_ref,
      apTransactionId: '',
      amount: '',
      transactionStatus: '',
      message: '',
      // No hash to check on a poll; `settleOrder` skips the integrity check when
      // this is empty and relies entirely on Order Confirmation, which is the
      // only thing that decides the outcome anyway.
      secureHash: '',
    });

    if (result.paymentStatus !== null) {
      paymentStatus = result.paymentStatus;
    }
  }

  sendJson(res, 200, {
    orderRef: order.order_ref,
    paymentStatus,
    status: order.status,
    paymentMethod: order.payment_method,
    amount: Number(order.amount),
    currency: order.currency,
    createdAt: order.created_at,
    settled: SETTLED.has(paymentStatus),
  });
};

export default withErrorHandling('orders.status', handler);
