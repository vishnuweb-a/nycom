import {
  AIRPAY_STATUS,
  verifySecureHash,
  verifyTransaction,
  type SecureHashInput,
} from './airpay.js';
import { db } from './db.js';
import { isLiveMid } from './env.js';
import { logTransition } from './http.js';
import { log } from './log.js';

/**
 * Order settlement — the single place an order may be marked paid.
 *
 * Both the server-to-server callback and the browser return land here, because
 * both are untrusted and neither may be believed on its own. The rule this
 * module exists to enforce is short:
 *
 *   Nothing reported by the caller decides the outcome. Not the status, not
 *   the amount, not `ap_SecureHash`. The only thing that marks an order paid
 *   is Airpay's Order Confirmation API answering, server-to-server, that it
 *   was paid — for the amount we independently computed at checkout.
 *
 * `ap_SecureHash` is checked, and a mismatch is logged and refused, but a match
 * proves only that the payload was not mangled in transit. CRC32 is unkeyed and
 * every input is derivable by anyone holding the merchant ID and username, so a
 * valid hash is not evidence of anything an attacker could not have produced.
 */

export type SettlementOutcome =
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'pending'
  /** Already in a terminal state; this call changed nothing. */
  | 'already_settled'
  | 'unknown_order'
  | 'hash_mismatch'
  | 'amount_mismatch'
  | 'unverifiable';

export interface SettlementResult {
  readonly outcome: SettlementOutcome;
  readonly orderRef: string;
  readonly paymentStatus: string | null;
}

/** The fields Airpay posts back, however they arrived. */
export interface CallbackPayload {
  readonly orderRef: string;
  readonly apTransactionId: string;
  readonly amount: string;
  readonly transactionStatus: string;
  readonly message: string;
  readonly secureHash: string;
  readonly customerVpa?: string | undefined;
}

interface OrderRow {
  readonly order_ref: string;
  readonly amount: number;
  readonly payment_status: string;
  readonly payment_method: string;
}

/**
 * Payment states from which no further automatic transition is allowed.
 *
 * `requires_review` is included: once an order is flagged for human
 * investigation, a later callback must not quietly overwrite that flag.
 */
const TERMINAL = new Set(['paid', 'failed', 'cancelled', 'requires_review']);

/** The same list in the form PostgREST's `not.in` filter expects. */
const TERMINAL_FILTER = '("paid","failed","cancelled","requires_review")';

/** Amounts are compared to the paisa; anything looser is a rounding loophole. */
const AMOUNT_TOLERANCE = 0.001;

/**
 * Verifies and settles one order.
 *
 * Safe to call repeatedly with the same payload — see the idempotency notes at
 * each guard. Duplicate callbacks are expected, not exceptional: Airpay retries,
 * and the browser return can race the webhook.
 */
export const settleOrder = async (payload: CallbackPayload): Promise<SettlementResult> => {
  const { orderRef } = payload;

  const { data, error } = await db()
    .from('orders')
    .select('order_ref, amount, payment_status, payment_method')
    .eq('order_ref', orderRef)
    .maybeSingle();

  if (error !== null || data === null) {
    // An unknown reference is either a stale retry or someone probing the
    // endpoint. Log it and say nothing useful back.
    log.warn('payment.callback.unknown_order', { orderRef });

    return { outcome: 'unknown_order', orderRef, paymentStatus: null };
  }

  const order = data as unknown as OrderRow;

  // ── Idempotency guard #1: already in a terminal state ─────────────────────
  // The cheap path for the common duplicate. The conditional UPDATE below is
  // the guard that actually holds under concurrency; this one just avoids a
  // pointless Order Confirmation call on the second, third and fourth delivery.
  if (TERMINAL.has(order.payment_status)) {
    logTransition('payment.callback.duplicate', {
      orderRef,
      paymentStatus: order.payment_status,
    });

    return { outcome: 'already_settled', orderRef, paymentStatus: order.payment_status };
  }

  // ── Integrity check (not authentication) ──────────────────────────────────
  const hashInput: SecureHashInput = {
    transactionId: payload.orderRef,
    apTransactionId: payload.apTransactionId,
    amount: payload.amount,
    transactionStatus: payload.transactionStatus,
    message: payload.message,
    customerVpa: payload.customerVpa,
  };

  if (payload.secureHash !== '' && !verifySecureHash(hashInput, payload.secureHash)) {
    log.warn('payment.callback.hash_mismatch', { orderRef });

    return { outcome: 'hash_mismatch', orderRef, paymentStatus: order.payment_status };
  }

  // ── The only trustworthy step ─────────────────────────────────────────────
  // Order Confirmation works only against a live MID. On sandbox the trusted
  // path is unavailable, so the order stays unsettled rather than being marked
  // paid on the strength of a callback body. This is a deliberate refusal: a
  // sandbox convenience flag here would be the exact hole this module exists
  // to close, and it would ship to production the first time someone
  // mis-set AIRPAY_ENV.
  if (!isLiveMid()) {
    log.warn('payment.verify.skipped_sandbox', {
      orderRef,
      note: 'Order Confirmation requires a live MID; order left unsettled',
    });

    return { outcome: 'unverifiable', orderRef, paymentStatus: order.payment_status };
  }

  const confirmation = await verifyTransaction(orderRef);

  if (confirmation === null) {
    // Could not reach or parse Airpay. Not a failure — an unknown. Leaving the
    // order unsettled lets a later callback, or the success page's polling,
    // resolve it. Marking it failed here would strand a genuine payment.
    log.error('payment.verify.inconclusive', { orderRef });

    return { outcome: 'pending', orderRef, paymentStatus: order.payment_status };
  }

  const status = confirmation.transactionStatus;

  if (status === AIRPAY_STATUS.IN_PROCESS) {
    logTransition('payment.verify.in_process', { orderRef });

    return { outcome: 'pending', orderRef, paymentStatus: order.payment_status };
  }

  if (status !== AIRPAY_STATUS.SUCCESS) {
    const outcome = await transition(orderRef, 'failed', confirmation.apTransactionId);

    logTransition('payment.settled.failed', { orderRef, transactionStatus: status });

    return { outcome: outcome ? 'failed' : 'already_settled', orderRef, paymentStatus: 'failed' };
  }

  // ── Amount validation ─────────────────────────────────────────────────────
  // Airpay says it succeeded; check it succeeded for the amount we priced.
  // `order.amount` came from the catalogue at checkout and has never been
  // client-writable, so this compares Airpay's figure against a trusted one.
  if (
    confirmation.amount === null ||
    Math.abs(confirmation.amount - Number(order.amount)) > AMOUNT_TOLERANCE
  ) {
    log.error('payment.verify.amount_mismatch', {
      orderRef,
      expected: Number(order.amount),
      reported: confirmation.amount,
    });

    // Deliberately not paid, and deliberately not failed either: money may well
    // have moved, just not the amount expected. Recorded as `requires_review` so
    // automation stops here and a human investigates.
    //
    // Leaving it `initiated` — as an earlier revision did — was wrong: the
    // reconciliation sweep would re-verify it forever and the shopper would sit
    // on "processing" indefinitely, with nothing surfacing the discrepancy.
    await transition(orderRef, 'requires_review', confirmation.apTransactionId);

    return { outcome: 'amount_mismatch', orderRef, paymentStatus: 'requires_review' };
  }

  const applied = await transition(orderRef, 'paid', confirmation.apTransactionId);

  if (!applied) {
    // Lost the race to a concurrent callback. That is a correct outcome, not an
    // error — the other caller settled it, exactly once.
    logTransition('payment.settled.race_lost', { orderRef });

    return { outcome: 'already_settled', orderRef, paymentStatus: 'paid' };
  }

  logTransition('payment.settled.paid', {
    orderRef,
    amount: Number(order.amount),
    apTransactionId: confirmation.apTransactionId,
  });

  return { outcome: 'paid', orderRef, paymentStatus: 'paid' };
};

/**
 * Conditionally moves an order to a terminal payment state.
 *
 * The `not.in` predicate is the real idempotency mechanism: the guard and the
 * write are one statement, so two callbacks arriving simultaneously cannot both
 * pass. Postgres applies the row lock; whichever loses updates zero rows and is
 * told so by the returned array being empty.
 *
 * This is why no distributed lock and no Redis is needed — the database already
 * provides the only atomicity required.
 */
const transition = async (
  orderRef: string,
  paymentStatus: 'paid' | 'failed' | 'cancelled' | 'requires_review',
  apTransactionId: string | null,
): Promise<boolean> => {
  const { data, error } = await db()
    .from('orders')
    .update({
      payment_status: paymentStatus,
      ap_transactionid: apTransactionId,
      ap_verified_at: new Date().toISOString(),
    })
    .eq('order_ref', orderRef)
    .not('payment_status', 'in', TERMINAL_FILTER)
    .select('order_ref');

  if (error !== null) {
    log.error('payment.transition.failed', { orderRef, paymentStatus });

    return false;
  }

  return (data ?? []).length > 0;
};

/**
 * Marks an order cancelled when the shopper abandons the gateway.
 *
 * Only ever moves an order out of `initiated`, so it cannot undo a payment that
 * a callback settled while the shopper was pressing back.
 */
export const cancelOrder = async (orderRef: string): Promise<boolean> => {
  const applied = await transition(orderRef, 'cancelled', null);

  if (applied) {
    logTransition('payment.settled.cancelled', { orderRef });
  }

  return applied;
};
