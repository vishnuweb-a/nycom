import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { serverEnv } from './env.js';
import { PublicError } from './http.js';
import { errorMessage, log, type LogFields } from './log.js';

/**
 * Airpay v4 protocol primitives — encryption, checksum, private key, OAuth.
 *
 * Every derivation here is transcribed from the Airpay documentation as
 * recorded in `docs/payment.md` §8. None of it is inferred, and none of it
 * should be "tidied": the byte-level details below are load-bearing, and each
 * one that looks wrong is explained where it appears.
 *
 * Nothing in this module logs a credential, a derived key, an `encdata` blob or
 * an access token. `log.ts` redacts those field names as a second line of
 * defence, but the first is simply not passing them.
 */

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * Airpay hosts. The environment is selected by MID and credentials, not by
 * hostname — Airpay publishes no separate sandbox subdomain.
 */
const KRAKEN_BASE = 'https://kraken.airpay.co.in/airpay/pay/v4/api';

/** The hosted payment page the customer's browser is POSTed to. */
export const PAYMENT_ACTION_URL = 'https://payments.airpay.co.in/pay/v4/';

/**
 * OAuth2 token endpoint. CONFIRMED against the official OAuth2 page.
 *
 * The prose there heads the section `…/api/oauth2` while its PHP sample sets
 * `CURLOPT_URL => '…/api/oauth2/'`. The trailing slash is kept because the
 * runnable sample is the better evidence of what the server actually routes,
 * and it matches the sibling endpoints (`/verify/`, `/vpavalidate/`).
 */
const OAUTH_URL = `${KRAKEN_BASE}/oauth2/`;

/** Order Confirmation. Live MID only — see `verifyTransaction`. */
const ORDER_CONFIRMATION_URL = `${KRAKEN_BASE}/verify/`;

// ─── Dates ──────────────────────────────────────────────────────────────────

/**
 * Today's date in IST, as `YYYY-MM-DD`.
 *
 * Airpay's reference implementation is PHP `date('Y-m-d')` on a server running
 * in IST. Vercel runs in UTC. Between 00:00 and 05:30 IST the UTC date is still
 * *yesterday*, so a checksum built from `toISOString().slice(0, 10)` would be
 * computed against the wrong day and rejected — every night, for five and a
 * half hours, and never during a working-hours test.
 *
 * `en-CA` is used because its short date format is exactly ISO `YYYY-MM-DD`.
 */
export const istDate = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

// ─── Key derivation ─────────────────────────────────────────────────────────

const sha256Hex = (input: string): string =>
  createHash('sha256').update(input, 'utf8').digest('hex');

const md5Hex = (input: string): string => createHash('md5').update(input, 'utf8').digest('hex');

/**
 * `privatekey = sha256(SECRET_KEY @ USERNAME :|: PASSWORD)`.
 *
 * Note this is a per-merchant constant, not a per-request signature: it does
 * not commit to the order, the amount, or the time. In the hosted-page flow it
 * is POSTed from the customer's browser, so it is visible to anyone who opens
 * DevTools on the checkout. That is inherent to Airpay's design — its own
 * plugins do the same — and the consequence is that its presence in a request
 * authenticates nothing. Never treat receiving it as proof of anything.
 */
export const privateKey = (): string => {
  const env = serverEnv();

  return sha256Hex(`${env.AIRPAY_SECRET_KEY}@${env.AIRPAY_USERNAME}:|:${env.AIRPAY_PASSWORD}`);
};

/**
 * The AES key: the MD5 of `USERNAME~:~PASSWORD`, kept as its 32-character
 * hexadecimal *string* and used as ASCII bytes.
 *
 * This is the single most misread detail in the protocol. MD5 produces 16 raw
 * bytes — a 128-bit key, which is not a valid AES-256 key. Airpay's PHP
 * reference passes the output of `md5()`, and PHP's `md5()` returns the hex
 * string by default, so what actually reaches OpenSSL is 32 ASCII characters:
 * exactly the 32 bytes AES-256 requires.
 *
 * Hex-decoding this back to 16 bytes would produce a different key and a
 * silently undecryptable payload. Do not "fix" it.
 */
const aesKey = (): Buffer => {
  const env = serverEnv();

  return Buffer.from(md5Hex(`${env.AIRPAY_USERNAME}~:~${env.AIRPAY_PASSWORD}`), 'ascii');
};

// ─── Encryption ─────────────────────────────────────────────────────────────

/** IV length in characters — 16 hex characters, used as 16 ASCII bytes. */
const IV_LENGTH = 16;

/**
 * Encrypts a payload into Airpay's `encdata`.
 *
 * Format: `AES-256-CBC` with PKCS#5/7 padding, base64-encoded, prefixed with
 * the initialisation vector in the clear.
 *
 *     encdata = <16 hex chars of IV> + base64(ciphertext)
 *
 * The IV follows the same ASCII-of-hex convention as the key: 16 hexadecimal
 * characters treated as 16 bytes, not 8 bytes hex-decoded.
 */
export const encrypt = (payload: Readonly<Record<string, string | number>>): string => {
  const iv = randomBytes(IV_LENGTH / 2)
    .toString('hex')
    .slice(0, IV_LENGTH);

  const cipher = createCipheriv('aes-256-cbc', aesKey(), Buffer.from(iv, 'ascii'));

  const encrypted =
    cipher.update(JSON.stringify(payload), 'utf8', 'base64') + cipher.final('base64');

  return iv + encrypted;
};

/**
 * Reverses `encrypt`. Used for callback bodies that arrive encrypted.
 *
 * Returns `null` rather than throwing on malformed input: a callback is an
 * untrusted, unauthenticated request, and a decryption failure is an expected
 * outcome to be handled, not an exception to propagate.
 */
export const decrypt = (encdata: string): string | null => {
  try {
    if (encdata.length <= IV_LENGTH) {
      return null;
    }

    const iv = encdata.slice(0, IV_LENGTH);
    const body = encdata.slice(IV_LENGTH);

    const decipher = createDecipheriv('aes-256-cbc', aesKey(), Buffer.from(iv, 'ascii'));

    return decipher.update(body, 'base64', 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
};

// ─── Checksum ───────────────────────────────────────────────────────────────

/**
 * `checksum = sha256(values-sorted-by-key, concatenated, + IST date)`.
 *
 * Sorting is by key — PHP `ksort` — and only the *values* are concatenated,
 * with no separator. The date is appended last and must be the IST date; see
 * `istDate` for why that is not the same as the UTC date.
 */
export const checksum = (
  payload: Readonly<Record<string, string | number>>,
  date: string = istDate(),
): string => {
  const concatenated = Object.keys(payload)
    .sort()
    .map((key) => String(payload[key]))
    .join('');

  return sha256Hex(concatenated + date);
};

// ─── ap_SecureHash (CRC32) ──────────────────────────────────────────────────

const CRC32_TABLE: readonly number[] = (() => {
  const table = new Array<number>(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

/** CRC-32 (IEEE 802.3), matching PHP's `crc32()`, as an unsigned decimal string. */
export const crc32 = (input: string): string => {
  const bytes = Buffer.from(input, 'utf8');
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return ((crc ^ 0xffffffff) >>> 0).toString(10);
};

/** The fields `ap_SecureHash` is computed over, in order. */
export interface SecureHashInput {
  readonly transactionId: string;
  readonly apTransactionId: string;
  readonly amount: string;
  readonly transactionStatus: string;
  readonly message: string;
  /** Present for UPI transactions only, appended last when supplied. */
  readonly customerVpa?: string | undefined;
}

/**
 * Recomputes `ap_SecureHash` and compares it to the value Airpay sent.
 *
 * ⚠ This is an integrity check, not authentication. CRC32 is unkeyed, and every
 * input is either public or known to anyone holding the merchant ID and
 * username. Anyone able to POST to the callback can compute a valid hash for a
 * payload of their choosing, including a forged SUCCESS.
 *
 * A passing result means "probably not corrupted in transit" and nothing more.
 * A payment is only ever confirmed by `verifyTransaction`.
 */
export const verifySecureHash = (input: SecureHashInput, received: string): boolean => {
  const env = serverEnv();

  const parts = [
    input.transactionId,
    input.apTransactionId,
    input.amount,
    input.transactionStatus,
    input.message,
    env.AIRPAY_MID,
    env.AIRPAY_USERNAME,
  ];

  if (input.customerVpa !== undefined && input.customerVpa !== '') {
    parts.push(input.customerVpa);
  }

  return crc32(parts.join(':')) === received.trim();
};

// ─── OAuth2 ─────────────────────────────────────────────────────────────────

interface CachedToken {
  readonly token: string;
  /** Epoch milliseconds after which the cached token must not be reused. */
  readonly expiresAt: number;
}

/**
 * Module-scoped token cache.
 *
 * Airpay tokens live 300 seconds. Vercel reuses a warm function instance across
 * invocations, so caching here spares an OAuth round trip on every checkout
 * without any shared infrastructure. A cold start simply mints a new token.
 */
let tokenCache: CachedToken | null = null;

/** Refresh this far before nominal expiry, so a token cannot expire in flight. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

/**
 * Must stay comfortably below the platform's function timeout.
 *
 * Vercel's default maximum duration is 10 seconds. At the previous 15s this
 * abort could never fire first: a hung gateway got the whole function killed by
 * the platform instead, which produces a bare 502 and — worse — no log at all,
 * because the catch block never runs. Timing out at 8s guarantees the error is
 * ours, handled, and recorded.
 */
const HTTP_TIMEOUT_MS = 8_000;

/**
 * Extracts Airpay's own status fields from a failed response, for logging.
 *
 * Only these four keys are ever read, and only when scalar. The raw body is
 * never logged: an Airpay error can echo the submitted request, which would put
 * `encdata` — and therefore the credentials inside it — into the log.
 *
 * ⚠ The outer envelope is not the verdict. A rejected OAuth grant still returns
 * status_code 200, response_code "00", status "success", message "Success" —
 * those describe the *transport*, not the outcome. The decision lives in
 * `data.success`, with the reason in `data.msg`. Both are read below.
 */
const describeFailure = (body: unknown): LogFields => {
  const unwrapped = unwrapResponse(body);

  if (typeof unwrapped !== 'object' || unwrapped === null) {
    return { airpayBody: 'unparseable' };
  }

  const record = unwrapped as Record<string, unknown>;

  const readScalar = (source: Record<string, unknown>, key: string): string | undefined => {
    const value = source[key];

    if (typeof value === 'boolean') {
      return String(value);
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return undefined;
    }

    // Bounded: a gateway message is short, and an unbounded one could carry an
    // echo of the request. Truncating keeps the diagnostic without the risk.
    return String(value).slice(0, 200);
  };

  /*
   * `data` carries the real outcome, and it is not the same thing as the outer
   * envelope.
   *
   * The envelope reports whether the *request* was accepted: a rejected OAuth
   * grant still comes back as status_code 200, response_code "00",
   * status "success", message "Success". Reading only those fields made a
   * refusal look like an authenticated success, which cost a full diagnostic
   * cycle. `data.success` is the actual verdict and `data.msg` the reason.
   */
  const data = record.data;
  const dataRecord =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};

  return {
    airpayStatusCode: readScalar(record, 'status_code'),
    airpayResponseCode: readScalar(record, 'response_code'),
    airpayStatus: readScalar(record, 'status'),
    airpayMessage: readScalar(record, 'message'),
    airpayDataSuccess: readScalar(dataRecord, 'success'),
    airpayDataMsg: readScalar(dataRecord, 'msg') ?? readScalar(dataRecord, 'message'),
  };
};

/** `fetch` with a hard timeout, so a hung gateway cannot hold the function open. */
const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, HTTP_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Fetches an OAuth2 access token, reusing a cached one while it is still valid.
 *
 * The credentials travel inside `encdata`, not as plain form fields — the token
 * request is encrypted and checksummed exactly like every other v4 call.
 */
export const getAccessToken = async (): Promise<string> => {
  const now = Date.now();

  if (tokenCache !== null && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  const env = serverEnv();

  const payload = {
    client_id: env.AIRPAY_CLIENT_ID,
    /*
     * AIRPAY_SECRET_KEY — established empirically against the live gateway.
     *
     * The merchant stated that AIRPAY_API_KEY was the OAuth client secret, and
     * this originally used it. Airpay rejected every such request with
     * `data.success: false, data.msg: "Invalid client id or secret"`, while the
     * identical request carrying AIRPAY_SECRET_KEY returned a token. The same
     * result held across url-encoded and multipart bodies and both URL forms,
     * so the credential is the only variable that mattered.
     *
     * A live gateway saying yes to one value and no to the other is stronger
     * evidence than either the documentation or the merchant's recollection,
     * which is why the stated mapping is overridden here.
     *
     * Note this means AIRPAY_SECRET_KEY serves two roles: the OAuth secret and
     * the `secret` in the privatekey derivation. AIRPAY_API_KEY is consequently
     * unused by this integration — see the note in `env.ts`.
     */
    client_secret: env.AIRPAY_SECRET_KEY,
    merchant_id: env.AIRPAY_MID,
    grant_type: 'client_credentials',
  } as const;

  const body = new URLSearchParams({
    merchant_id: env.AIRPAY_MID,
    encdata: encrypt(payload),
    checksum: checksum(payload),
  });

  let response: Response;

  try {
    response = await fetchWithTimeout(OAUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (error) {
    log.error('airpay.oauth.unreachable', { reason: errorMessage(error) });

    throw new PublicError(
      502,
      'gateway_unavailable',
      'We could not reach the payment provider. Please try again in a moment.',
    );
  }

  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null);

    log.error('airpay.oauth.http_error', {
      status: response.status,
      url: OAUTH_URL,
      ...describeFailure(failure),
    });

    throw new PublicError(
      502,
      'gateway_unavailable',
      'We could not start a secure payment. Please try again in a moment.',
    );
  }

  const raw: unknown = await response.json().catch(() => null);
  const parsed = unwrapResponse(raw);

  const token = readTokenField(parsed, 'access_token');
  const expiresIn = Number(readTokenField(parsed, 'expires_in') ?? '300');

  if (token === null) {
    // Airpay error 903 is a credential mismatch — the first thing to suspect if
    // this fires is the AIRPAY_API_KEY → client_secret mapping.
    //
    // `envelopeDecrypted` distinguishes the two ways this can happen: a genuine
    // rejection (decryption worked, Airpay simply returned no token) from a
    // decryption failure (wrong AES key, so the response was never readable).
    // They need opposite fixes and would otherwise look identical.
    log.error('airpay.oauth.no_token', {
      httpStatus: response.status,
      envelopeDecrypted: parsed !== raw,
      // Key names only — says exactly where the token actually lives if the
      // search above still misses it, without another deploy cycle.
      shape: describeShape(parsed),
      ...describeFailure(raw),
    });

    throw new PublicError(
      502,
      'gateway_unavailable',
      'We could not start a secure payment. Please try again in a moment.',
    );
  }

  const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 300_000;

  tokenCache = {
    token,
    expiresAt: now + Math.max(ttl - TOKEN_SAFETY_MARGIN_MS, 30_000),
  };

  log.info('airpay.oauth.issued', { ttlSeconds: Math.round(ttl / 1000) });

  return token;
};

/**
 * Unwraps an Airpay v4 response body.
 *
 * v4 returns `{"response": "<16-hex IV><base64 ciphertext>"}` for the encrypted
 * endpoints, and the plaintext envelope directly for the others. The docs
 * disagree with themselves about which is which — the Decryption page states
 * "all the API responses are encrypted", while the Order Confirmation page says
 * its response is not — so rather than committing to one reading, this detects
 * the envelope and decrypts only when it is actually present.
 *
 * Confirmed shape once decrypted (OAuth2 page):
 *
 *     { status_code, response_code, status, message,
 *       data: { access_token, expires_in, scope } }
 *
 * Returns the plaintext object either way, or the original value when there is
 * no envelope to unwrap.
 */
const unwrapResponse = (body: unknown): unknown => {
  if (typeof body !== 'object' || body === null) {
    return body;
  }

  const envelope = (body as Record<string, unknown>).response;

  if (typeof envelope !== 'string' || envelope === '') {
    return body;
  }

  const plaintext = decrypt(envelope);

  if (plaintext === null) {
    return body;
  }

  try {
    return JSON.parse(plaintext);
  } catch {
    return body;
  }
};

/** Bounds the search below, so a cyclic or pathological body cannot hang it. */
const MAX_SEARCH_DEPTH = 6;

/**
 * Finds a scalar field anywhere in a decoded response body.
 *
 * The previous version looked only at the top level and one level under `data`,
 * which is what the OAuth2 documentation shows. Against the live gateway that
 * failed: Airpay answered `response_code: "00", status: "success"` — a genuine,
 * authenticated success — and the token was simply not where the documented
 * shape said it would be, so the request was reported as a credential failure.
 *
 * Rather than hard-code a second guess at the nesting, this walks the structure.
 * It also parses nested JSON *strings*, because v4 double-encodes some payloads:
 * a `data` field arriving as `"{\"access_token\":...}"` is a string, not an
 * object, and every `typeof x === 'object'` check silently skips it.
 *
 * Being shape-tolerant here is the right trade: the value is verified by use —
 * a wrong token simply fails the next call — so a permissive search cannot
 * cause anything worse than the error we already had.
 */
const findField = (value: unknown, field: string, depth = 0): string | null => {
  if (depth > MAX_SEARCH_DEPTH || value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }

    try {
      return findField(JSON.parse(trimmed), field, depth + 1);
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findField(entry, field, depth + 1);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const direct = record[field];

  if (typeof direct === 'string' || typeof direct === 'number') {
    return String(direct);
  }

  for (const nested of Object.values(record)) {
    const found = findField(nested, field, depth + 1);

    if (found !== null) {
      return found;
    }
  }

  return null;
};

/**
 * Reads the access token, tolerating the naming variants v4 uses in practice.
 *
 * `access_token` is what the documentation shows; the others are cheap to try
 * and cost nothing if absent.
 */
const readTokenField = (body: unknown, field: string): string | null => {
  if (field !== 'access_token') {
    return findField(body, field);
  }

  for (const alias of ['access_token', 'accessToken', 'access-token', 'token'] as const) {
    const found = findField(body, alias);

    if (found !== null && found !== '') {
      return found;
    }
  }

  return null;
};

/**
 * Describes the *shape* of a response — key names only, never values.
 *
 * If the token still cannot be found, this says exactly where to look next
 * without another round trip. Field names are not secrets; the values beside
 * them may be, so none are read.
 */
const describeShape = (body: unknown, depth = 0): string => {
  if (depth > 2 || body === null || body === undefined) {
    return typeof body;
  }

  if (Array.isArray(body)) {
    return `array[${body.length}]`;
  }

  if (typeof body !== 'object') {
    return typeof body;
  }

  return Object.entries(body as Record<string, unknown>)
    .map(([key, value]) => {
      if (value !== null && typeof value === 'object') {
        return `${key}:{${describeShape(value, depth + 1)}}`;
      }

      return `${key}:${value === null ? 'null' : typeof value}`;
    })
    .join(',');
};

/** Clears the cached token. Exported for tests. */
export const resetTokenCache = (): void => {
  tokenCache = null;
};

// ─── Order Confirmation ─────────────────────────────────────────────────────

/** Airpay's numeric transaction status. */
export const AIRPAY_STATUS = {
  SUCCESS: 200,
  IN_PROCESS: 211,
  FAILED: 400,
} as const;

export interface TransactionConfirmation {
  readonly orderId: string;
  readonly apTransactionId: string | null;
  /** In rupees, as reported by Airpay. */
  readonly amount: number | null;
  readonly transactionStatus: number | null;
  readonly paymentStatus: string | null;
}

/**
 * Calls Airpay's Order Confirmation API — the only trustworthy answer to
 * "was this actually paid?".
 *
 * Neither the browser redirect, nor the callback body, nor `ap_SecureHash` can
 * answer that question: all three are attacker-reachable. This is a
 * server-to-server request authenticated by an OAuth token, and it is the sole
 * basis on which an order may be marked paid.
 *
 * Returns `null` when the answer cannot be obtained, which callers must treat
 * as "not paid yet" rather than as a failure to report to the customer.
 *
 * ⚠ Documented constraint: "This API will work only on live MID, for the
 * sandbox MID this API will not work." The caller is responsible for gating on
 * `isLiveMid()`; this function does not silently succeed on sandbox.
 */
export const verifyTransaction = async (
  orderRef: string,
): Promise<TransactionConfirmation | null> => {
  const token = await getAccessToken();

  let response: Response;

  try {
    response = await fetchWithTimeout(
      `${ORDER_CONFIRMATION_URL}?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ orderid: orderRef }),
      },
    );
  } catch (error) {
    log.error('airpay.verify.unreachable', { orderRef, reason: errorMessage(error) });

    return null;
  }

  if (!response.ok) {
    log.error('airpay.verify.http_error', { orderRef, status: response.status });

    return null;
  }

  // The Order Confirmation page says this response is not encrypted; the
  // Decryption page says every response is. `unwrapResponse` handles both, so
  // the contradiction cannot break verification either way.
  const body: unknown = unwrapResponse(await response.json().catch(() => null));

  if (typeof body !== 'object' || body === null) {
    log.error('airpay.verify.unparseable', { orderRef });

    return null;
  }

  const record = body as Record<string, unknown>;
  const data =
    typeof record.data === 'object' && record.data !== null
      ? (record.data as Record<string, unknown>)
      : record;

  const numeric = (value: unknown): number | null => {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  };

  const text = (value: unknown): string | null =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : null;

  return {
    orderId: text(data.orderid ?? data.ORDERID) ?? orderRef,
    apTransactionId: text(data.ap_transactionid ?? data.APTRANSACTIONID),
    amount: numeric(data.amount ?? data.AMOUNT),
    transactionStatus: numeric(data.transaction_status ?? data.TRANSACTIONSTATUS),
    paymentStatus: text(data.transaction_payment_status ?? data.TRANSACTIONPAYMENTSTATUS),
  };
};
