import type { VercelRequest } from '@vercel/node';

import { decrypt } from './airpay.js';
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
const decodeRawBody = (text: string): unknown => {
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

  const decoded: Record<string, string> = {};

  for (const [key, value] of new URLSearchParams(trimmed)) {
    decoded[key] = value;
  }

  return Object.keys(decoded).length > 0 ? decoded : null;
};

/** Normalises whatever `req.body` turned out to be into something enumerable. */
const asRecord = (body: unknown): unknown => {
  if (typeof body === 'string') {
    return decodeRawBody(body);
  }

  if (Buffer.isBuffer(body)) {
    return decodeRawBody(body.toString('utf8'));
  }

  return body;
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
  let fields = merge(flatten(req.query), flatten(asRecord(req.body)));

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
