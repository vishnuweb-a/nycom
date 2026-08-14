import type { VercelRequest } from '@vercel/node';

import { decrypt } from './airpay';
import type { CallbackPayload } from './settle';

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

/** Lower-cased key → value, from whichever envelope the data arrived in. */
const flatten = (source: unknown): Map<string, string> => {
  const fields = new Map<string, string>();

  if (typeof source !== 'object' || source === null) {
    return fields;
  }

  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number') {
      fields.set(key.toLowerCase(), String(value));
    }
  }

  return fields;
};

const pick = (fields: Map<string, string>, ...names: readonly string[]): string => {
  for (const name of names) {
    const value = fields.get(name.toLowerCase());

    if (value !== undefined && value !== '') {
      return value;
    }
  }

  return '';
};

/**
 * Extracts a callback payload from a request, or `null` if it is unreadable.
 *
 * A `null` return is an expected outcome — anyone can POST junk to a public
 * callback URL — and callers must handle it without treating it as an error.
 */
export const parseCallback = (req: VercelRequest): CallbackPayload | null => {
  // Query and body are merged so the same parser serves the GET return leg and
  // the POST webhook. Body wins on conflict, being the harder one to forge into
  // a link someone could be tricked into visiting.
  let fields = new Map([...flatten(req.query), ...flatten(req.body)]);

  // Encrypted envelope, when configured. The plaintext replaces the outer
  // fields entirely rather than merging, so an attacker cannot pair a genuine
  // encdata with unencrypted fields of their own choosing.
  const encdata = pick(fields, 'encdata', 'encresponse', 'response');

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

  const orderRef = pick(fields, 'TRANSACTIONID', 'transactionid', 'orderid', 'order_id');

  if (orderRef === '') {
    return null;
  }

  const customerVpa = pick(fields, 'CUSTOMERVPA', 'customer_vpa', 'customervpa');

  return {
    orderRef,
    apTransactionId: pick(fields, 'APTRANSACTIONID', 'ap_transactionid', 'aptransactionid'),
    amount: pick(fields, 'AMOUNT', 'amount'),
    transactionStatus: pick(fields, 'TRANSACTIONSTATUS', 'transaction_status', 'transactionstatus'),
    message: pick(fields, 'MESSAGE', 'message'),
    secureHash: pick(fields, 'ap_SecureHash', 'apsecurehash', 'ap_securehash', 'securehash'),
    customerVpa: customerVpa === '' ? undefined : customerVpa,
  };
};
