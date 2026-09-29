import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

import { db } from '../../_lib/db.js';
import {
  logTransition,
  methodNotAllowed,
  PublicError,
  withErrorHandling,
} from '../../_lib/http.js';
import { generateAccessToken, generateOrderRef, priceOrder } from '../../_lib/pricing.js';
import { rupeesToPaise } from '../../_lib/sabpaisa/amount.js';
import { createSabPaisaPayment } from '../../_lib/sabpaisa/createPayment.js';
import { generateMerchantTxnId } from '../../_lib/sabpaisa/crypto.js';
import { enquireTransaction } from '../../_lib/sabpaisa/enquiry.js';

/**
 * POST /api/payments/sabpaisa/create — begin a SabPaisa payment.
 *
 * Re-prices the basket from the catalogue, records an order and a SabPaisa
 * payment session, creates the session with SabPaisa, and REDIRECTS the browser
 * to the hosted checkout.
 *
 * The redirect is the point. The documented server-side approach is used so the
 * `clientSecret` travels only in a `Location` header the browser follows — it
 * is never in a JSON response body, so it cannot reach `localStorage`,
 * analytics, an error report or a console log. The browser posts a form here
 * and follows a 303; it never holds secret material as data.
 *
 * The signing happens here and only here. The browser never sees a credential,
 * never computes a checksum, and never has a say in the amount.
 */

/**
 * The request schema.
 *
 * As with the Airpay endpoint, note what is absent: no price, no subtotal, no
 * shipping fee, no total. There is deliberately nowhere for the client to state
 * what it thinks the order costs.
 */
const requestSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        size: z.string().min(1).max(32),
        quantity: z.number().int().positive().max(20),
      }),
    )
    .min(1)
    .max(50),
  address: z.object({
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/),
    email: z.string().trim().email().max(120),
    address: z.string().trim().min(1).max(200),
    landmark: z.string().trim().max(100),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(80),
    pincode: z
      .string()
      .trim()
      .regex(/^[1-9]\d{5}$/),
  }),
});

const CURRENCY = 'INR';

/** How long a created session is presumed valid when SabPaisa states nothing. */
const DEFAULT_SESSION_MINUTES = 15;

/**
 * Reads the request body, which arrives in one of two shapes.
 *
 * The browser hands off by POSTing a form, so the basket arrives as a JSON
 * string in a `payload` field of an `application/x-www-form-urlencoded` body.
 * A form POST is used rather than `fetch` because the response is a 303 the
 * browser must follow as a navigation — that is what keeps the `clientSecret`
 * out of the bundle.
 *
 * A direct JSON body is also accepted, so the endpoint stays testable and
 * usable by a non-browser client.
 */
const readBody = (req: VercelRequest): unknown => {
  const body: unknown = req.body;

  if (typeof body !== 'object' || body === null) {
    return body;
  }

  const payload = (body as Record<string, unknown>).payload;

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  return body;
};

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);

    return;
  }

  const parsed = requestSchema.safeParse(readBody(req));

  if (!parsed.success) {
    throw new PublicError(
      400,
      'invalid_request',
      'We could not read your order details. Please review your cart and try again.',
    );
  }

  const { items: proposed, address } = parsed.data;

  // ── The security boundary. Everything past here uses the server's figures. ──
  const priced = await priceOrder(proposed);

  const orderRef = generateOrderRef();
  const accessToken = generateAccessToken();

  /*
   * A fresh reference for every attempt. Never reused: a reused
   * `merchantTxnId` makes Transaction Enquiry ambiguous about which attempt it
   * is answering, and that question is the whole basis of settlement.
   */
  const merchantTxnId = generateMerchantTxnId();

  // Paise, integer — the unit Create Payment and Transaction Enquiry both use.
  const expectedAmountPaise = rupeesToPaise(priced.grandTotal);

  const { error: orderError } = await db().from('orders').insert({
    order_ref: orderRef,
    access_token: accessToken,
    status: 'pending',
    payment_method: 'sabpaisa',
    payment_status: 'initiated',
    amount: priced.grandTotal,
    currency: CURRENCY,
    address,
    items: priced.items,
  });

  if (orderError) {
    throw new PublicError(
      503,
      'order_not_created',
      'We could not start your payment. Please try again in a moment.',
    );
  }

  /*
   * The payment session is persisted BEFORE the customer is sent to SabPaisa.
   *
   * This row, not browser state and not a query parameter, is the authority on
   * what Yarnvia expected to be paid. If the create call times out, if the
   * customer closes the tab, if the return never arrives — the expected amount,
   * currency and reference are already on disk, and the reconciler can finish
   * the job without them.
   */
  const expiresAt = new Date(Date.now() + DEFAULT_SESSION_MINUTES * 60_000).toISOString();

  const { error: sessionError } = await db().from('sabpaisa_payments').insert({
    merchant_txn_id: merchantTxnId,
    order_ref: orderRef,
    expected_amount_paise: expectedAmountPaise,
    currency: CURRENCY,
    status: 'created',
    expires_at: expiresAt,
  });

  if (sessionError) {
    throw new PublicError(
      503,
      'payment_not_created',
      'We could not start your payment. Please try again in a moment.',
    );
  }

  logTransition('sabpaisa.payment.initiated', {
    orderRef,
    merchantTxnId,
    amountPaise: expectedAmountPaise,
    lineCount: priced.items.length,
  });

  const created = await createSabPaisaPayment({
    merchantTxnId,
    amountPaise: expectedAmountPaise,
    currency: CURRENCY,
    customerName: `${address.firstName} ${address.lastName}`,
    customerEmail: address.email,
    customerPhone: address.phone,
  });

  if (created.kind === 'rejected') {
    await db()
      .from('sabpaisa_payments')
      .update({
        status: 'failed',
        last_enquiry_status: `create_rejected_${String(created.status)}`,
      })
      .eq('merchant_txn_id', merchantTxnId);

    await db().from('orders').update({ payment_status: 'failed' }).eq('order_ref', orderRef);

    throw new PublicError(
      502,
      'payment_declined',
      'We could not start your payment. Please try again in a moment.',
    );
  }

  /*
   * The create outcome is unknown: the request may or may not have produced a
   * payable session. Per the retry rules, we do NOT send another create.
   *
   * Instead we ask Transaction Enquiry about the reference we already minted.
   * If a session exists, the reconciler and the return leg will settle it; if
   * it does not, nothing was charged. Either way the customer is told to try
   * again rather than being silently handed a second payable session.
   */
  if (created.kind === 'uncertain') {
    const enquiry = await enquireTransaction(merchantTxnId);

    await db()
      .from('sabpaisa_payments')
      .update({
        status: 'unconfirmed',
        last_enquiry_status:
          enquiry.kind === 'answered' ? enquiry.status : `create_uncertain:${created.reason}`,
      })
      .eq('merchant_txn_id', merchantTxnId);

    throw new PublicError(
      503,
      'payment_unconfirmed',
      'We could not confirm whether your payment started. Please check your orders before trying again.',
    );
  }

  await db()
    .from('sabpaisa_payments')
    .update({
      payment_id: created.paymentId,
      status: 'redirected',
      ...(created.expiresAt !== null ? { expires_at: created.expiresAt } : {}),
    })
    .eq('merchant_txn_id', merchantTxnId);

  /*
   * The browser is sent onward with a 303 and never receives the redirect URL
   * as readable data — it carries the `clientSecret`, which must not reach
   * script, storage or analytics. `no-store` keeps the secret-bearing
   * `Location` out of any shared cache.
   *
   * The order reference and its opaque read key go into cookies scoped to this
   * site rather than into the SabPaisa URL, so the success page can identify
   * the order on return without the reference travelling through the gateway.
   */
  const cookieFlags = 'Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax';

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', [
    `yv_sp_ref=${encodeURIComponent(orderRef)}; ${cookieFlags}`,
    `yv_sp_key=${encodeURIComponent(accessToken)}; ${cookieFlags}`,
  ]);
  res.redirect(303, created.redirectUrl);
};

export default withErrorHandling('sabpaisa.payment.create', handler);
