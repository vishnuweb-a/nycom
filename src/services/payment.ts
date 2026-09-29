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

// ─── SabPaisa ───────────────────────────────────────────────────────────────

/**
 * Guards against a double submission producing two payable sessions.
 *
 * Held only for the navigation window, not for the life of the page. The latch
 * exists to swallow the second of two clicks a fraction of a second apart,
 * while `form.submit()` is already navigating away — that pair is one customer
 * action and must mint one `merchantTxnId`.
 *
 * It is released after `HANDOFF_LATCH_MS` because a shopper who comes *back* —
 * cancelled at the gateway, hit the back button, returned to a failed payment —
 * is making a genuinely new attempt. Latching permanently would leave the SPA
 * with a Pay button that silently does nothing until a full page reload, which
 * reads as a broken checkout. A deliberate retry SHOULD mint a fresh reference:
 * the previous session is dead, and enquiry must stay unambiguous about which
 * attempt it is answering.
 *
 * Note where the real protection lives. This is a UX guard against a fumbled
 * double-click; it is not the integrity boundary. The server re-prices every
 * request, and no duplicate session can ever be settled twice — settlement is
 * keyed on `merchantTxnId` and is idempotent once terminal.
 */
let sabpaisaHandoffStarted = false;

/** How long one handoff suppresses a repeat submission. */
const HANDOFF_LATCH_MS = 10_000;

/**
 * Hands off to SabPaisa by POSTing a form to our own server.
 *
 * A form POST to `/api/payments/sabpaisa/create` rather than `fetch`, because
 * the server answers with a 303 to SabPaisa's hosted checkout and the browser
 * must *follow* that redirect as a navigation. That is the documented
 * server-side approach, and it is what keeps the `clientSecret` out of this
 * bundle entirely: the secret travels in a `Location` header the browser acts
 * on, never in a response body this code could read, store or log.
 *
 * Note what this function does not have: a response to inspect. There is no
 * payment id, no checkout URL and no client secret in the browser at any point.
 *
 * `sabpaisaHandoffStarted` is a module-level latch rather than component state
 * because it must survive a re-render and cannot be reset by one. Every extra
 * submission would mint a fresh `merchantTxnId` server-side and create a second
 * payable session for a single customer action, so the second click must do
 * nothing at all — for the duration of the handoff. See the latch's own note
 * for why it is released afterwards rather than held forever.
 *
 * Returns whether the handoff was actually started, so a caller that was
 * suppressed can leave its own UI state alone.
 */
export const redirectToSabPaisa = (
  items: readonly CartItem[],
  address: AddressFormValues,
): boolean => {
  if (sabpaisaHandoffStarted) {
    return false;
  }

  sabpaisaHandoffStarted = true;

  /*
   * Released on a timer rather than never. If the navigation succeeds this
   * page is gone and the timer is irrelevant; if it did not, the shopper is
   * still here and must be able to try again.
   */
  window.setTimeout(() => {
    sabpaisaHandoffStarted = false;
  }, HANDOFF_LATCH_MS);

  const form = document.createElement('form');

  form.method = 'POST';
  form.action = '/api/payments/sabpaisa/create';
  form.style.display = 'none';

  /*
   * The basket is sent as JSON in a single field. Only the identity of each
   * line travels — product, size, quantity — and deliberately no price,
   * subtotal or total: the server re-prices from the catalogue, so there is
   * nothing here for anyone to tamper with.
   */
  const payload = {
    items: items.map((item) => ({
      productId: item.productId,
      size: item.selectedSize,
      quantity: item.quantity,
    })),
    address,
  };

  const input = document.createElement('input');

  input.type = 'hidden';
  input.name = 'payload';
  input.value = JSON.stringify(payload);
  form.append(input);

  document.body.append(form);
  form.submit();

  return true;
};

/** Test-only: clears the handoff latch between cases. */
export const resetSabPaisaHandoffLatch = (): void => {
  sabpaisaHandoffStarted = false;
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
