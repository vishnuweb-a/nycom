import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  describeCallbackRequest,
  hydrateRequestBody,
  parseCallbackEnvelope,
  type ParsedCallback,
} from './callbackPayload.js';
import { db } from './db.js';
import { log } from './log.js';
import { forwardCallback } from './relay.js';
import { settleOrder, type SettlementResult } from './settle.js';

/**
 * The canonical inbound-callback pipeline.
 *
 * Airpay reaches Yarnvia on more than one URL — the merchant-registered
 * Response URL, the IPN URL, and the `/api/payments/*` pair the earlier
 * revision assumed — and every one of them must arrive at the *same*
 * settlement. This module is that single place. The endpoint files under `api/`
 * are transport adapters: they decide what to say back to the caller, and
 * nothing else.
 *
 * The rule this module exists to hold:
 *
 *   There is exactly one settlement implementation, `settleOrder`, and exactly
 *   one relay, `forwardCallback`. No route may re-implement, bypass or reorder
 *   either. A second settlement path is a second set of bugs and a second
 *   chance to get a payment wrong.
 *
 * Order is load-bearing: parse, then settle, then relay. Settlement completes
 * before the relay is attempted, so a KKChat outage can never delay, corrupt or
 * roll back a verified payment — see `relay.ts`, which cannot throw.
 */

/** Which registered URL a callback arrived on. Purely diagnostic. */
export type CallbackLeg =
  /** Server-to-server notification from Airpay. */
  | 'ipn'
  /** The customer's browser, handed back from the hosted payment page. */
  | 'browser'
  /** The `/api/payments/return` endpoint. */
  | 'return';

export interface CallbackFlowOptions {
  readonly leg: CallbackLeg;
  /**
   * Whether to forward the callback to KKChat once settlement has finished.
   *
   * Only the `/api/payments/return` leg opts out, because it has never relayed
   * and nothing downstream expects it to start.
   */
  readonly relay: boolean;
}

export interface CallbackFlowResult {
  /** `null` when the request carried no recognisable Airpay callback. */
  readonly parsed: ParsedCallback | null;
  /** `null` exactly when `parsed` is — there was nothing to settle. */
  readonly settlement: SettlementResult | null;
}

/**
 * Parses, settles and (optionally) relays one inbound Airpay callback.
 *
 * Never throws for hostile input: an unreadable body is an expected outcome on
 * a public endpoint and comes back as `{ parsed: null, settlement: null }`.
 */
export const processAirpayCallback = async (
  req: VercelRequest,
  options: CallbackFlowOptions,
): Promise<CallbackFlowResult> => {
  /*
   * The platform parses a body only for the content types it recognises, and
   * leaves the stream unread for everything else — `multipart/form-data` most
   * of all. Draining it here, before parsing, is what makes the parser see a
   * callback that Vercel handed over as `undefined`.
   *
   * A no-op whenever the body was already parsed, which is every case the
   * endpoint has served until now.
   */
  await hydrateRequestBody(req);

  const parsed = parseCallbackEnvelope(req);

  if (parsed === null) {
    /*
     * Logged with enough shape to tell the three causes apart — a body that
     * never arrived, an envelope that would not decrypt, and field names we do
     * not recognise — because each needs a different fix and, on a live
     * gateway, each wrong guess costs another real payment to observe. Names
     * and counts only; never a value.
     */
    log.warn('payment.callback.unparseable', {
      leg: options.leg,
      method: req.method ?? 'unknown',
      ...describeCallbackRequest(req),
    });

    return { parsed: null, settlement: null };
  }

  log.info('payment.callback.received', {
    leg: options.leg,
    orderRef: parsed.payload.orderRef,
    transactionStatus: parsed.payload.transactionStatus,
    fieldCount: Object.keys(parsed.fields).length,
  });

  /*
   * The only step that may change an order's payment state. It re-verifies
   * against Airpay's Order Confirmation API before anything is marked paid —
   * the callback body is a prompt to go and check, never proof of payment —
   * and it is idempotent, so a duplicate delivery settles nothing twice.
   */
  const settlement = await settleOrder(parsed.payload);

  if (options.relay) {
    /*
     * Awaited rather than fired and forgotten. On a serverless runtime the
     * instance may be frozen the moment the response is written, which would
     * silently drop an un-awaited request — the relay would appear to work
     * locally and never fire in production.
     *
     * Awaiting is safe because `forwardCallback` cannot throw and is bounded by
     * its own 5s timeout, so the worst case is a slightly later response.
     */
    await forwardCallback(parsed.fields, parsed.payload.orderRef);
  }

  return { parsed, settlement };
};

// ─── The browser return leg ─────────────────────────────────────────────────

/** Reads a possibly-repeated request header as a single lower-cased string. */
const header = (req: VercelRequest, name: string): string => {
  const value = req.headers[name];
  const first = Array.isArray(value) ? value[0] : value;

  return first === undefined ? '' : first.toLowerCase();
};

/**
 * Whether this request is a customer's browser arriving on the Response URL,
 * as opposed to Airpay's server posting an IPN.
 *
 * Airpay has the *same* URL registered for both, so one handler serves both and
 * this decides only the shape of the reply — a redirect for a browser, JSON for
 * a machine. It never decides whether settlement runs: both legs have already
 * been through `processAirpayCallback` by the time this is consulted, so a
 * forged header buys nobody a payment they did not make.
 *
 * `Sec-Fetch-Dest` is the reliable signal — every current browser sends it on a
 * top-level navigation, and no server-to-server HTTP client sends it at all.
 * `Accept` is the fallback for anything older.
 */
export const isBrowserNavigation = (req: VercelRequest): boolean => {
  const dest = header(req, 'sec-fetch-dest');

  if (dest !== '') {
    return dest === 'document' || dest === 'iframe' || dest === 'frame';
  }

  return header(req, 'accept').includes('text/html');
};

/**
 * The absolute origin to send the browser back to.
 *
 * `PUBLIC_SITE_ORIGIN` is authoritative. `x-forwarded-host` is set by Vercel's
 * proxy and is used only to build a redirect back to this same deployment,
 * never as a trust signal.
 */
const siteOrigin = (req: VercelRequest): string => {
  const configured = process.env.PUBLIC_SITE_ORIGIN;

  if (configured !== undefined && configured !== '') {
    return configured.replace(/\/$/, '');
  }

  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const resolved = Array.isArray(host) ? host[0] : host;

  return resolved === undefined ? '' : `https://${resolved}`;
};

/**
 * Where to send the shopper after Airpay hands their browser back.
 *
 * Note what the target does *not* contain: any claim about whether the payment
 * succeeded. It carries the order reference and the order's opaque read key,
 * and the success page then asks the server what actually happened. A redirect
 * proves only that a browser was pointed at a URL — anyone can type one.
 *
 * The read key is looked up server-side rather than taken from the request, so
 * a crafted return URL cannot hand someone else's token back.
 */
export const successPageLocation = async (
  req: VercelRequest,
  orderRef: string | null,
): Promise<string> => {
  const origin = siteOrigin(req);
  const unknown = `${origin}/order-success?status=unknown`;

  if (orderRef === null) {
    return unknown;
  }

  const { data } = await db()
    .from('orders')
    .select('access_token')
    .eq('order_ref', orderRef)
    .maybeSingle();

  const accessToken = (data as { access_token?: string } | null)?.access_token;

  if (accessToken === undefined) {
    return unknown;
  }

  // Concatenated rather than built with `new URL`, which throws on the bare
  // relative path an unresolvable origin would leave behind.
  const query = new URLSearchParams({ ref: orderRef, t: accessToken });

  return `${origin}/order-success?${query.toString()}`;
};

/** Sends the browser onward. 303, so a POSTed return becomes a GET. */
export const redirectBrowser = (res: VercelResponse, location: string): void => {
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(303, location);
};
