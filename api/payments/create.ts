import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

import {
  checksum,
  encrypt,
  getAccessToken,
  PAYMENT_ACTION_URL,
  privateKey,
} from '../_lib/airpay.js';
import { db } from '../_lib/db.js';
import { serverEnv } from '../_lib/env.js';
import {
  logTransition,
  methodNotAllowed,
  PublicError,
  sendJson,
  withErrorHandling,
} from '../_lib/http.js';
import {
  formatAmount,
  generateAccessToken,
  generateOrderRef,
  priceOrder,
} from '../_lib/pricing.js';

/**
 * POST /api/payments/create — begin an online payment.
 *
 * Takes a proposed basket and a shipping address, re-prices the basket from
 * Supabase, records an `initiated` order, and returns the signed fields the
 * browser must POST to Airpay's hosted page.
 *
 * The signing happens here and only here. The browser never sees a credential,
 * never computes a checksum, and never has a say in the amount.
 */

/**
 * The request schema.
 *
 * Note what is absent: no price, no subtotal, no shipping fee, no total. There
 * is deliberately nowhere for the client to state what it thinks the order
 * costs, so there is nothing to accidentally trust later.
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

/** ISO 4217 numeric and alphabetic codes for the Indian rupee. */
const CURRENCY_CODE = '356';
const ISO_CURRENCY = 'inr';

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);

    return;
  }

  const parsed = requestSchema.safeParse(req.body);

  if (!parsed.success) {
    // The validation detail stays server-side: it describes our schema, and the
    // shopper cannot act on it anyway.
    throw new PublicError(
      400,
      'invalid_request',
      'We could not read your order details. Please review your cart and try again.',
    );
  }

  const { items: proposed, address } = parsed.data;

  // ── The security boundary. Everything past here uses the server's figures. ──
  const priced = await priceOrder(proposed);

  const env = serverEnv();
  const orderRef = generateOrderRef();
  const accessToken = generateAccessToken();

  const { error: insertError } = await db().from('orders').insert({
    order_ref: orderRef,
    access_token: accessToken,
    status: 'pending',
    payment_method: 'airpay',
    payment_status: 'initiated',
    amount: priced.grandTotal,
    currency: 'INR',
    address,
    items: priced.items,
  });

  if (insertError) {
    throw new PublicError(
      503,
      'order_not_created',
      'We could not start your payment. Please try again in a moment.',
    );
  }

  logTransition('payment.initiated', {
    orderRef,
    amount: priced.grandTotal,
    lineCount: priced.items.length,
  });

  // The OAuth token is minted after the order exists, so a gateway outage
  // leaves a recorded `initiated` order rather than a silent nothing.
  const token = await getAccessToken();

  /*
   * The transaction payload. Airpay receives the reference, the amount and the
   * buyer's contact details — and nothing else. No SKUs, no line items, no
   * sizes, no shipping address. Those are Yarnvia's to hold.
   */
  const payload = {
    orderid: orderRef,
    amount: formatAmount(priced.grandTotal),
    currency_code: CURRENCY_CODE,
    iso_currency: ISO_CURRENCY,
    buyer_email: address.email,
    buyer_phone: address.phone,
    buyer_firstname: address.firstName,
    buyer_lastname: address.lastName,
  } as const;

  sendJson(res, 200, {
    orderRef,
    accessToken,
    amount: priced.grandTotal,
    actionUrl: `${PAYMENT_ACTION_URL}?token=${encodeURIComponent(token)}`,
    // The four fields Airpay's hosted page expects as a form POST.
    fields: {
      merchant_id: env.AIRPAY_MID,
      encdata: encrypt(payload),
      checksum: checksum(payload),
      privatekey: privateKey(),
    },
  });
};

export default withErrorHandling('payment.create', handler);
