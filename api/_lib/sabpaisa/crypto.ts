import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { sabpaisaEnv } from './env.js';

/**
 * SabPaisa signing and signature verification.
 *
 * Both directions use HMAC-SHA256 over a canonical string, keyed by the
 * merchant Secret Key. The key never leaves this module, is never logged, and
 * is never returned to a caller.
 */

/**
 * The Create Payment checksum.
 *
 * Canonical string, per the PG 3.0 documentation:
 *
 *   merchantId|merchantTxnId|amount|currency|timestamp
 *
 * `amount` is PAISE and `timestamp` is UNIX SECONDS, and both must be byte-
 * identical to the values actually sent in the request body — a checksum over a
 * different timestamp than the one transmitted is the single most common way
 * this integration fails, and it fails as an opaque gateway rejection. The
 * caller therefore passes the exact values it will send, and `createPayment`
 * computes the timestamp once and uses that one value for both.
 */
export const createPaymentChecksum = (input: {
  readonly merchantId: string;
  readonly merchantTxnId: string;
  readonly amountPaise: number;
  readonly currency: string;
  readonly timestampSeconds: number;
}): string => {
  const canonical = [
    input.merchantId,
    input.merchantTxnId,
    String(input.amountPaise),
    input.currency,
    String(input.timestampSeconds),
  ].join('|');

  return createHmac('sha256', sabpaisaEnv().SABPAISA_SECRET_KEY)
    .update(canonical, 'utf8')
    .digest('hex');
};

/**
 * A server-generated Create Payment timestamp, in UNIX SECONDS.
 *
 * Seconds, not milliseconds: SabPaisa validates this against its own clock
 * within a freshness window, and a millisecond value is ~1000× too large, which
 * reads as a timestamp fifty thousand years in the future and is rejected.
 *
 * Generated on the server so a skewed or hostile client clock cannot push a
 * request outside the window or replay an old one.
 */
export const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

// ─── The return-URL signature ───────────────────────────────────────────────

/**
 * The parameters SabPaisa appends to the return URL, excluding `signature`.
 *
 * Exactly these seven, and the set is closed: the canonical string is built by
 * sorting these keys, so an extra parameter an attacker appends is not
 * included in the string and therefore cannot alter what is verified — but it
 * also must not silently displace a real one.
 */
export const RETURN_SIGNED_PARAMS = [
  'amount',
  'merchant_txn_id',
  'paid_amount',
  'payment_mode',
  'status',
  'timestamp',
  'transaction_id',
] as const;

export type ReturnSignedParam = (typeof RETURN_SIGNED_PARAMS)[number];

/**
 * Builds the canonical string the return signature is computed over.
 *
 * Per the documentation: take the seven non-signature parameters, sort them
 * alphabetically by key, join each as `key=value`, and join the pairs with `|`:
 *
 *   amount=1.00|merchant_txn_id=YV-…|paid_amount=1.00|payment_mode=UPI|status=SUCCESS|timestamp=1700000000000|transaction_id=SP…
 *
 * `RETURN_SIGNED_PARAMS` is already in sorted order and is used as the sort
 * order rather than re-sorting at runtime, so the ordering is fixed by the
 * source and cannot drift with a locale-dependent comparator.
 */
export const returnSignatureBase = (params: Readonly<Record<ReturnSignedParam, string>>): string =>
  RETURN_SIGNED_PARAMS.map((key) => `${key}=${params[key]}`).join('|');

/**
 * Verifies the return-URL signature.
 *
 * Constant-time comparison, so response timing cannot be used to forge a
 * signature byte by byte. A length mismatch short-circuits — `timingSafeEqual`
 * throws on unequal lengths — and a non-hex or wrong-length signature is
 * rejected before any comparison, since it cannot be a valid HMAC-SHA256 hex
 * digest and attempting the compare would only risk a throw.
 *
 * A valid signature proves the parameters are authentic and unmodified. It does
 * NOT prove the payment succeeded: see `settle.ts`, which treats a verified
 * return only as permission to go and ask Transaction Enquiry.
 */
export const verifyReturnSignature = (
  params: Readonly<Record<ReturnSignedParam, string>>,
  signature: string,
): boolean => {
  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }

  const expected = createHmac('sha256', sabpaisaEnv().SABPAISA_SECRET_KEY)
    .update(returnSignatureBase(params), 'utf8')
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.toLowerCase(), 'utf8');

  return a.length === b.length && timingSafeEqual(a, b);
};

// ─── References ─────────────────────────────────────────────────────────────

/**
 * Mints a fresh `merchantTxnId`.
 *
 * Crypto-grade entropy, because this value identifies real money, appears in
 * the SabPaisa dashboard and is the key Transaction Enquiry is asked about. A
 * guessable reference would let someone enquire about other merchants' — or
 * other shoppers' — transactions.
 *
 * Every legitimate payment attempt gets a new one. It is never reused across
 * attempts: a reused reference makes Transaction Enquiry ambiguous about which
 * attempt it is answering, which is precisely the question the settlement path
 * depends on.
 */
export const generateMerchantTxnId = (): string => {
  const time = Date.now().toString(36).toUpperCase().slice(-6);

  return `YVSP-${time}-${randomBytes(5).toString('hex').toUpperCase()}`;
};
