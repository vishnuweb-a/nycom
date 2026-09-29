import { log } from '../log.js';
import { parseEnquiryPaise } from './amount.js';
import { postWithRetry } from './client.js';
import { sabpaisaEnv } from './env.js';

/**
 * Transaction Enquiry — the payment authority.
 *
 * Nothing else in this integration is permitted to conclude that a payment
 * succeeded. Not the return URL's `status`, not a valid return signature, not
 * the browser, not a query parameter. Those establish only that SabPaisa sent
 * us something authentic; this establishes what SabPaisa actually believes
 * happened, server-to-server, over a channel the customer cannot influence.
 */

/** Documented PG 3.0 enquiry path. */
const ENQUIRY_PATH = '/api/v2/payments/enquiry';

/**
 * A normalised enquiry outcome.
 *
 * `unknown` is a first-class result, not an error case to be smoothed over. It
 * means SabPaisa did not give us a usable answer, and the only honest thing to
 * do with a payment in that state is leave it unconfirmed.
 */
export type EnquiryResult =
  | {
      readonly kind: 'answered';
      readonly status: string;
      readonly merchantTxnId: string | null;
      readonly amountPaise: number | null;
      readonly currency: string | null;
      readonly spTxnId: string | null;
      readonly paymentMode: string | null;
      readonly clientCode: string | null;
    }
  | { readonly kind: 'unknown'; readonly reason: string };

/** Reads a string field that the API may render as a string or a number. */
const str = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  return typeof value === 'number' ? String(value) : null;
};

/**
 * The enquiry response envelope varies: some deployments answer with the
 * transaction at the top level, others nest it under `data`. Both are accepted
 * rather than guessing one, because guessing wrong reads every field as absent
 * and would turn a successful payment into a mismatch.
 */
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
 * Asks SabPaisa about one transaction.
 *
 * Uses `clientCode` and `merchantTxnId`, per the documented enquiry contract —
 * note that `clientCode` is the enquiry identifier, NOT the `merchantId` used
 * by Create Payment. They are supplied from separate configuration values and
 * are never substituted for one another, even where this merchant's account
 * happens to have both set to the same string.
 */
export const enquireTransaction = async (merchantTxnId: string): Promise<EnquiryResult> => {
  const env = sabpaisaEnv();

  const response = await postWithRetry(
    ENQUIRY_PATH,
    { clientCode: env.SABPAISA_CLIENT_CODE, merchantTxnId },
    'sabpaisa.enquiry',
  );

  if (response.kind === 'unreachable') {
    // Deliberately NOT mapped to a failure. See the module note.
    log.warn('sabpaisa.enquiry.unreachable', { merchantTxnId, reason: response.reason });

    return { kind: 'unknown', reason: response.reason };
  }

  if (response.kind === 'http_error') {
    log.warn('sabpaisa.enquiry.http_error', { merchantTxnId, status: response.status });

    /*
     * A 404 is genuinely informative: SabPaisa has never heard of this
     * reference, so no payment session exists for it. That is still not
     * "failed" — it is "there is nothing here" — and the caller decides. Any
     * other status tells us nothing we can act on.
     */
    return {
      kind: 'unknown',
      reason: response.status === 404 ? 'not_found' : `http_${String(response.status)}`,
    };
  }

  const record = unwrap(response.body);
  const status = str(record?.status);

  if (record === null || status === null) {
    log.warn('sabpaisa.enquiry.unreadable', { merchantTxnId });

    return { kind: 'unknown', reason: 'unreadable_response' };
  }

  return {
    kind: 'answered',
    status: status.toUpperCase(),
    merchantTxnId: str(record.merchantTxnId),
    amountPaise: parseEnquiryPaise(record.amountPaise),
    currency: str(record.currency)?.toUpperCase() ?? null,
    spTxnId: str(record.spTxnId) ?? str(record.transactionId),
    paymentMode: str(record.paymentMode),
    clientCode: str(record.clientCode),
  };
};
