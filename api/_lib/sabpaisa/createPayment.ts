import { log } from '../log.js';
import { postOnce } from './client.js';
import { createPaymentChecksum, nowInSeconds } from './crypto.js';
import { isApprovedCheckoutUrl, sabpaisaEnv, sabpaisaReturnUrl } from './env.js';

/**
 * SabPaisa Create Payment.
 *
 * Deliberately NOT retried. A create request that times out may already have
 * produced a payable session on SabPaisa's side, and sending another would
 * create a second payable session for one customer action — the worst failure
 * mode this integration has, because the customer can be charged twice. An
 * uncertain create is therefore resolved by asking Transaction Enquiry about
 * the `merchantTxnId` we already minted, never by creating again.
 */

const CREATE_PATH = '/api/v2/payments';

export type CreatePaymentResult =
  | {
      readonly kind: 'created';
      readonly paymentId: string;
      /** The full redirect target, `checkoutUrl?clientSecret=…`, already built. */
      readonly redirectUrl: string;
      readonly expiresAt: string | null;
      /** As echoed by SabPaisa, for cross-checking against what we sent. */
      readonly merchantTxnId: string | null;
    }
  /** SabPaisa refused. Deterministic; no session exists. */
  | { readonly kind: 'rejected'; readonly status: number }
  /**
   * Outcome genuinely unknown — a session may or may not exist for this
   * `merchantTxnId`. The caller must NOT create another one.
   */
  | { readonly kind: 'uncertain'; readonly reason: string };

const str = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];

  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

/** Accepts both a flat response and one nested under `data`. */
const unwrap = (body: unknown): Record<string, unknown> | null => {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const top = body as Record<string, unknown>;
  const nested = top.data;

  if (typeof nested === 'object' && nested !== null && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }

  return top;
};

/**
 * Creates a SabPaisa payment session.
 *
 * `merchantTxnId` is minted by the caller and passed in, so that an uncertain
 * outcome still leaves the caller holding the reference it needs to enquire
 * about. `amountPaise` is the server-priced figure in paise — the unit Create
 * Payment expects.
 */
export const createSabPaisaPayment = async (input: {
  readonly merchantTxnId: string;
  readonly amountPaise: number;
  readonly currency: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
}): Promise<CreatePaymentResult> => {
  const env = sabpaisaEnv();

  /*
   * One timestamp, computed once, in UNIX SECONDS, on the server.
   *
   * The same variable is both signed and sent. Computing it twice — once for
   * the checksum and once for the body — is the classic way to produce a
   * checksum over a timestamp one second away from the transmitted one, which
   * the gateway rejects with no useful diagnostic.
   */
  const timestampSeconds = nowInSeconds();

  const checksum = createPaymentChecksum({
    merchantId: env.SABPAISA_MERCHANT_ID,
    merchantTxnId: input.merchantTxnId,
    amountPaise: input.amountPaise,
    currency: input.currency,
    timestampSeconds,
  });

  const response = await postOnce(CREATE_PATH, {
    // Create Payment's identifier is `merchantId`. Transaction Enquiry's is
    // `clientCode`. They come from separate configuration and are never
    // interchanged, whatever their values happen to be for this merchant.
    merchantId: env.SABPAISA_MERCHANT_ID,
    merchantTxnId: input.merchantTxnId,
    amount: input.amountPaise,
    currency: input.currency,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    returnUrl: sabpaisaReturnUrl(),
    timestamp: timestampSeconds,
    checksum,
  });

  if (response.kind === 'unreachable') {
    log.warn('sabpaisa.create.uncertain', {
      merchantTxnId: input.merchantTxnId,
      reason: response.reason,
    });

    return { kind: 'uncertain', reason: response.reason };
  }

  if (response.kind === 'http_error') {
    /*
     * A 5xx or 429 is not a refusal we can rely on — SabPaisa may have created
     * the session and failed to tell us — so it is uncertain, not rejected.
     * Only a 4xx is a deterministic "no".
     */
    if (response.status >= 500 || response.status === 429) {
      log.warn('sabpaisa.create.uncertain', {
        merchantTxnId: input.merchantTxnId,
        status: response.status,
      });

      return { kind: 'uncertain', reason: `http_${String(response.status)}` };
    }

    log.warn('sabpaisa.create.rejected', {
      merchantTxnId: input.merchantTxnId,
      status: response.status,
    });

    return { kind: 'rejected', status: response.status };
  }

  const record = unwrap(response.body);

  if (record === null) {
    return { kind: 'uncertain', reason: 'unreadable_response' };
  }

  const paymentId = str(record, 'paymentId');
  const checkoutUrl = str(record, 'checkoutUrl');
  const clientSecret = str(record, 'clientSecret');

  /*
   * A 2xx missing any of the three is uncertain rather than rejected: the
   * session may exist, we simply cannot drive the customer to it.
   */
  if (paymentId === null || checkoutUrl === null || clientSecret === null) {
    log.warn('sabpaisa.create.incomplete_response', {
      merchantTxnId: input.merchantTxnId,
      // Presence flags only. The values are never logged, least of all the
      // client secret.
      hasPaymentId: paymentId !== null,
      hasCheckoutUrl: checkoutUrl !== null,
      hasClientSecret: clientSecret !== null,
    });

    return { kind: 'uncertain', reason: 'incomplete_response' };
  }

  /*
   * The checkout host is whatever SabPaisa returned — never hardcoded and never
   * reconstructed — but it is still validated before a paying customer is sent
   * to it. A compromised or misconfigured API response that named an
   * attacker's host would otherwise redirect shoppers, mid-payment, to a
   * convincing phishing page.
   */
  if (!isApprovedCheckoutUrl(checkoutUrl)) {
    log.error('sabpaisa.create.untrusted_checkout_url', {
      merchantTxnId: input.merchantTxnId,
    });

    return { kind: 'uncertain', reason: 'untrusted_checkout_url' };
  }

  /*
   * The documented PG 3.0 checkout destination: the returned `checkoutUrl`
   * with the returned `clientSecret` as a query parameter. Redirecting to
   * `checkoutUrl` alone lands on a checkout with no session and fails.
   *
   * Built here, server-side, and handed to the redirect as a `Location` header.
   * The browser is never given the secret as data it could store or leak.
   */
  const redirect = new URL(checkoutUrl);

  redirect.searchParams.set('clientSecret', clientSecret);

  log.info('sabpaisa.create.created', {
    merchantTxnId: input.merchantTxnId,
    paymentId,
    // Neither the secret nor the assembled redirect URL is logged: the URL
    // carries the secret in its query string.
  });

  return {
    kind: 'created',
    paymentId,
    redirectUrl: redirect.toString(),
    expiresAt: str(record, 'expiresAt'),
    merchantTxnId: str(record, 'merchantTxnId'),
  };
};
