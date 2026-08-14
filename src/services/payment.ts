import type { CartItem } from '@/types/cart';
import type { PaymentStatus } from '@/types/order';
import type { AddressFormValues } from '@/pages/Checkout/addressSchema';

/**
 * Online payment client.
 *
 * This module deliberately performs no cryptography. It does not sign, hash,
 * encrypt or hold a credential — a browser cannot keep a secret, so every one
 * of those steps happens in `api/payments/create.ts` and the browser receives
 * only the opaque, already-signed fields it must forward.
 *
 * Note also what is not sent: no price, no subtotal, no total. The server
 * re-prices the basket from the catalogue, so there is nothing here for an
 * attacker to tamper with.
 */

/**
 * Fields Airpay's hosted page expects, generated and signed server-side.
 *
 * An index signature rather than four named keys, because this module's job is
 * to forward whatever the server signed without inspecting or reordering it. If
 * the protocol gains a field, `create.ts` is the only place that changes.
 */
type AirpayFormFields = Record<string, string>;

interface CreatePaymentResponse {
  readonly orderRef: string;
  readonly accessToken: string;
  /** The server's authoritative figure, for display and reconciliation only. */
  readonly amount: number;
  readonly actionUrl: string;
  readonly fields: AirpayFormFields;
}

/** A failure carrying a message written to be shown to the shopper. */
export class PaymentError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
  }
}

const GENERIC_FAILURE = 'We could not start your payment. Please try again in a moment.';

/**
 * Asks the server to create an order and sign a payment request.
 *
 * Only the identity of each line is sent — product, size, quantity.
 */
export const createPayment = async (
  items: readonly CartItem[],
  address: AddressFormValues,
): Promise<CreatePaymentResponse> => {
  let response: Response;

  try {
    response = await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((item) => ({
          productId: item.productId,
          size: item.selectedSize,
          quantity: item.quantity,
        })),
        address,
      }),
    });
  } catch {
    throw new PaymentError(
      'network_error',
      'We could not reach our servers. Check your connection and try again.',
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { error?: { message?: unknown } }).error?.message === 'string'
        ? (body as { error: { message: string } }).error.message
        : GENERIC_FAILURE;

    const code =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { error?: { code?: unknown } }).error?.code === 'string'
        ? (body as { error: { code: string } }).error.code
        : 'payment_failed';

    throw new PaymentError(code, message);
  }

  if (body === null || typeof body !== 'object') {
    throw new PaymentError('invalid_response', GENERIC_FAILURE);
  }

  return body as CreatePaymentResponse;
};

/**
 * Navigates to Airpay by submitting a hidden form.
 *
 * A form POST rather than a redirect because Airpay's hosted page expects the
 * signed fields as a form body. The form is built in the DOM and submitted
 * immediately; the values in it are already public by Airpay's design (see the
 * `privateKey` note in `api/_lib/airpay.ts`) and none of them is a Yarnvia
 * credential.
 */
export const redirectToAirpay = (payment: CreatePaymentResponse): void => {
  const form = document.createElement('form');

  form.method = 'POST';
  form.action = payment.actionUrl;
  form.style.display = 'none';

  const fields: Record<string, string> = payment.fields;

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');

    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
};

// ─── Authoritative status ───────────────────────────────────────────────────

export interface OrderStatusResponse {
  readonly orderRef: string;
  readonly paymentStatus: PaymentStatus;
  readonly amount: number;
  readonly settled: boolean;
}

/**
 * Reads an order's authoritative payment status from the server.
 *
 * The success page must call this rather than believing the redirect. Airpay
 * returning the customer to Yarnvia proves only that a browser was pointed at a
 * URL — it is not evidence that money moved, and anyone can visit that URL.
 */
export const fetchOrderStatus = async (
  orderRef: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<OrderStatusResponse | null> => {
  try {
    const response = await fetch(
      `/api/orders/${encodeURIComponent(orderRef)}?t=${encodeURIComponent(accessToken)}`,
      { signal: signal ?? null },
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as OrderStatusResponse;
  } catch {
    return null;
  }
};
