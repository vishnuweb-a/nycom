import type { VercelRequest } from '@vercel/node';

import { decrypt } from './airpay.js';
import type { LogFields } from './log.js';
import type { CallbackPayload } from './settle.js';

/**
 * Parses an Airpay callback or return payload.
 *
 * Airpay posts `application/x-www-form-urlencoded` fields, and depending on the
 * configuration may wrap them in an encrypted `encdata` blob instead. Both
 * shapes are accepted, and field names are matched case-insensitively because
 * the documentation and the live payloads disagree about casing
 * (`TRANSACTIONID` vs `transactionid`).
 *
 * Everything returned here is untrusted input. Parsing it successfully says
 * nothing about whether it is genuine — that is `settle.ts`'s problem.
 */

/**
 * Coerces a request body that the platform did not parse for us.
 *
 * Vercel's Node runtime populates `req.body` as an object only for the content
 * types it recognises — `application/json` and
 * `application/x-www-form-urlencoded`. Anything else arrives as a raw string or
 * Buffer, and a gateway that posts form fields under `text/plain`, an unusual
 * charset suffix, or no `Content-Type` at all would previously have flattened
 * to nothing and been rejected as unparseable.
 *
 * That is a silent money bug rather than a cosmetic one: the callback is
 * dropped, and the order waits for the reconciliation sweep instead. Decoding
 * the raw form here costs nothing and removes the dependency on Airpay sending
 * a header we do not control.
 */
const decodeRawBody = (text: string, contentType = ''): unknown => {
  const trimmed = text.trim();

  if (trimmed === '') {
    return null;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not JSON after all; fall through and try the form decoding below.
    }
  }

  // Tried before url-decoding, because a multipart body run through
  // URLSearchParams does not fail — it silently yields one nonsense key, which
  // would look like a successfully parsed callback carrying no order reference.
  if (/multipart\/form-data/i.test(contentType) || /name="[^"]+"/i.test(trimmed)) {
    const parts = decodeMultipart(text, contentType);

    if (parts !== null) {
      return parts;
    }
  }

  const decoded: Record<string, string> = {};

  for (const [key, value] of new URLSearchParams(trimmed)) {
    decoded[key] = value;
  }

  return Object.keys(decoded).length > 0 ? decoded : null;
};

/**
 * Decodes a `multipart/form-data` body into its simple field values.
 *
 * Vercel's runtime does not parse multipart at all — see `hydrateRequestBody`
 * below — so if that is what Airpay posts, this is the only thing standing
 * between a real payment and `payment.callback.unparseable`.
 *
 * Deliberately minimal: simple named text fields only. A callback carries a
 * dozen short scalars and no file upload, so there is no filename handling, no
 * transfer-encoding handling and no nesting. Anything it cannot understand it
 * skips, and a body it understands nothing of yields `null` like any other
 * unreadable input.
 *
 * The boundary is taken from the header when there is one and recovered from
 * the body's own first line when there is not, because the delimiter is
 * present in the payload either way.
 */
const decodeMultipart = (text: string, contentType: string): Record<string, string> | null => {
  const declared = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (declared?.[1] ?? declared?.[2] ?? '').trim();
  const delimiter =
    boundary !== '' ? `--${boundary}` : (/^(--[^\r\n]+)\r?\n/.exec(text)?.[1] ?? '');

  if (delimiter === '') {
    return null;
  }

  const decoded: Record<string, string> = {};

  for (const part of text.split(delimiter)) {
    const name = /name="([^"]*)"/i.exec(part)?.[1];

    if (name === undefined || name === '') {
      continue;
    }

    // Headers end at the first blank line; the value is everything after it,
    // less the CRLF the next delimiter is prefixed with.
    const separator = /\r?\n\r?\n/.exec(part);

    if (separator === null) {
      continue;
    }

    decoded[name] = part.slice(separator.index + separator[0].length).replace(/\r?\n$/, '');
  }

  return Object.keys(decoded).length > 0 ? decoded : null;
};

/** Normalises whatever `req.body` turned out to be into something enumerable. */
const asRecord = (body: unknown, contentType = ''): unknown => {
  if (typeof body === 'string') {
    return decodeRawBody(body, contentType);
  }

  if (Buffer.isBuffer(body)) {
    return decodeRawBody(body.toString('utf8'), contentType);
  }

  return body;
};

/** Reads a possibly-repeated request header as a single string. */
const header = (req: VercelRequest, name: string): string => {
  const value = req.headers[name];
  const first = Array.isArray(value) ? value[0] : value;

  return first ?? '';
};

/**
 * An Airpay callback is a dozen short fields. This is orders of magnitude
 * above that, and exists only so a public endpoint cannot be made to buffer
 * something enormous.
 */
const MAX_BODY_BYTES = 512 * 1024;

/**
 * Fills in `req.body` when the platform declined to.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Vercel's Node runtime parses a body only for content types it recognises.
 * From its own source (`getBodyParser`): `application/json` becomes an object,
 * `application/x-www-form-urlencoded` becomes an object, `text/plain` becomes a
 * string, `application/octet-stream` becomes a Buffer — and **every other
 * content type returns `undefined`**, with the request stream left unread.
 * A missing header is normalised to `text/plain`, so it is specifically a
 * *present but unrecognised* type that yields nothing.
 *
 * `multipart/form-data` is the one such type a payment gateway plausibly posts,
 * and for it `req.body` is `undefined` while the fields sit untouched in the
 * stream. Nothing downstream can find an order reference in `undefined`, so the
 * callback is logged unparseable and the payment goes unsettled — which is a
 * silent money bug, not a cosmetic one.
 *
 * The previous defence read a raw string or Buffer out of `req.body`. That case
 * is real but it is not this one: the platform never puts the raw bytes there
 * for an unrecognised type. Draining the stream is what actually closes the gap,
 * and it is what the reference integration has always done.
 *
 * Never throws, and never overwrites a body the platform already parsed.
 */
export const hydrateRequestBody = async (req: VercelRequest): Promise<void> => {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    return;
  }

  try {
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of req) {
      const buffer = Buffer.from(chunk as Buffer);

      size += buffer.length;

      if (size > MAX_BODY_BYTES) {
        return;
      }

      chunks.push(buffer);
    }

    if (chunks.length > 0) {
      req.body = Buffer.concat(chunks).toString('utf8');
    }
  } catch {
    // An already-consumed or aborted stream. Nothing to add, and nothing that
    // should stop the callback being answered.
  }
};

/**
 * Safe metadata about a request whose body could not be read.
 *
 * The log line that fires when a callback is unparseable previously recorded
 * only the leg and the method, which cannot distinguish the three ways this
 * fails: a body the platform did not parse, an envelope that will not decrypt,
 * and field names we do not recognise. They need different fixes, and each
 * wrong guess costs another real payment to observe.
 *
 * Key names are included; values are never. Airpay's field names are not
 * secrets, and they are the single most useful thing to see — but the values
 * beside them are a customer's phone, email and VPA.
 */
export const describeCallbackRequest = (req: VercelRequest): LogFields => {
  const body: unknown = req.body;
  const record = asRecord(body, header(req, 'content-type'));
  const keys =
    typeof record === 'object' && record !== null && !Array.isArray(record)
      ? Object.keys(record)
      : [];

  return {
    contentType: header(req, 'content-type') || '(none)',
    bodyType: Buffer.isBuffer(body) ? 'buffer' : Array.isArray(body) ? 'array' : typeof body,
    bodyLength: typeof body === 'string' ? body.length : null,
    decodedFieldCount: keys.length,
    // Bounded: names only, and never an unbounded list.
    decodedKeys: keys.slice(0, 40).join(',') || '(none)',
    queryKeys:
      Object.keys(req.query ?? {})
        .slice(0, 20)
        .join(',') || '(none)',
  };
};

/**
 * The scalar fields of an envelope, in both the forms downstream code needs.
 *
 * `lookup` is lower-cased for case-insensitive matching; `raw` keeps the casing
 * Airpay actually sent, because the outbound relay must reproduce the payload
 * as received rather than a normalised rewrite of it.
 */
interface Fields {
  readonly lookup: Map<string, string>;
  readonly raw: Record<string, string>;
}

const flatten = (source: unknown): Fields => {
  const lookup = new Map<string, string>();
  const raw: Record<string, string> = {};

  if (typeof source !== 'object' || source === null) {
    return { lookup, raw };
  }

  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number') {
      lookup.set(key.toLowerCase(), String(value));
      raw[key] = String(value);
    }
  }

  return { lookup, raw };
};

/** Merges two field sets, with `override` winning on conflict. */
const merge = (base: Fields, override: Fields): Fields => ({
  lookup: new Map([...base.lookup, ...override.lookup]),
  raw: { ...base.raw, ...override.raw },
});

const pick = (fields: Map<string, string>, ...names: readonly string[]): string => {
  for (const name of names) {
    const value = fields.get(name.toLowerCase());

    if (value !== undefined && value !== '') {
      return value;
    }
  }

  return '';
};

/** A parsed callback, plus the fields it was derived from. */
export interface ParsedCallback {
  readonly payload: CallbackPayload;
  /**
   * The Airpay fields exactly as received — original casing, original string
   * values, after any `encdata` envelope was opened. This is what the relay
   * forwards, so nothing here may be normalised or reformatted.
   */
  readonly fields: Readonly<Record<string, string>>;
}

/**
 * Extracts a callback payload and its source fields, or `null` if unreadable.
 *
 * A `null` return is an expected outcome — anyone can POST junk to a public
 * callback URL — and callers must handle it without treating it as an error.
 */
export const parseCallbackEnvelope = (req: VercelRequest): ParsedCallback | null => {
  // Query and body are merged so the same parser serves the GET return leg and
  // the POST webhook. Body wins on conflict, being the harder one to forge into
  // a link someone could be tricked into visiting.
  let fields = merge(flatten(req.query), flatten(asRecord(req.body, header(req, 'content-type'))));

  // Encrypted envelope, when configured. The plaintext replaces the outer
  // fields entirely rather than merging, so an attacker cannot pair a genuine
  // encdata with unencrypted fields of their own choosing.
  const encdata = pick(fields.lookup, 'encdata', 'encresponse', 'response');

  if (encdata !== '') {
    const plaintext = decrypt(encdata);

    if (plaintext !== null) {
      try {
        fields = flatten(JSON.parse(plaintext));
      } catch {
        return null;
      }
    }
  }

  const orderRef = pick(fields.lookup, 'TRANSACTIONID', 'transactionid', 'orderid', 'order_id');

  if (orderRef === '') {
    return null;
  }

  const customerVpa = pick(fields.lookup, 'CUSTOMERVPA', 'customer_vpa', 'customervpa');

  return {
    payload: {
      orderRef,
      apTransactionId: pick(
        fields.lookup,
        'APTRANSACTIONID',
        'ap_transactionid',
        'aptransactionid',
      ),
      amount: pick(fields.lookup, 'AMOUNT', 'amount'),
      transactionStatus: pick(
        fields.lookup,
        'TRANSACTIONSTATUS',
        'transaction_status',
        'transactionstatus',
      ),
      message: pick(fields.lookup, 'MESSAGE', 'message'),
      secureHash: pick(
        fields.lookup,
        'ap_SecureHash',
        'apsecurehash',
        'ap_securehash',
        'securehash',
      ),
      customerVpa: customerVpa === '' ? undefined : customerVpa,
    },
    fields: fields.raw,
  };
};

/**
 * Extracts just the normalised payload.
 *
 * The return leg has no relay to feed, so it takes this narrower view.
 */
export const parseCallback = (req: VercelRequest): CallbackPayload | null =>
  parseCallbackEnvelope(req)?.payload ?? null;
