import { db } from '../db.js';
import { log } from '../log.js';
import { sabpaisaEnv } from './env.js';
import { enquireTransaction, type EnquiryResult } from './enquiry.js';

/**
 * SabPaisa settlement — the single place a SabPaisa payment may be marked paid.
 *
 * The rule, stated once:
 *
 *   Nothing the caller reports decides the outcome. The local payment record is
 *   the authority on what Yarnvia EXPECTED to be paid; Transaction Enquiry is
 *   the authority on what SabPaisa ACTUALLY reports. A payment is marked paid
 *   only when both agree on status, reference, amount AND currency.
 *
 * Any disagreement fails closed. The states this can land in are chosen so that
 * no outcome is ever overstated:
 *
 *   paid                 everything agreed
 *   requires_review      SabPaisa says SUCCESS, but for the wrong amount,
 *                        currency or reference. Money probably moved. A human
 *                        decides; nothing leaves this state automatically.
 *   verification_failed  a signed return arrived but enquiry contradicted it
 *   unconfirmed          enquiry gave no usable answer. NOT a failure.
 *   failed / expired / cancelled   SabPaisa's own terminal verdicts
 *
 * Idempotent: settling an already-terminal payment changes nothing, so a
 * duplicated return and a reconciler pass cannot double-apply.
 */

export type SabPaisaSettlementOutcome =
  | 'paid'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'unconfirmed'
  | 'requires_review'
  | 'verification_failed'
  | 'already_settled'
  | 'unknown_transaction';

export interface SabPaisaSettlement {
  readonly outcome: SabPaisaSettlementOutcome;
  readonly merchantTxnId: string;
  readonly orderRef: string | null;
  readonly status: string | null;
}

interface PaymentRow {
  readonly merchant_txn_id: string;
  readonly order_ref: string;
  readonly expected_amount_paise: number;
  readonly currency: string;
  readonly status: string;
}

/** Statuses from which no further automatic transition is possible. */
const TERMINAL = [
  'paid',
  'failed',
  'expired',
  'cancelled',
  'requires_review',
  'verification_failed',
] as const;

const isTerminal = (status: string): boolean => (TERMINAL as readonly string[]).includes(status);

/** SabPaisa's terminal verdicts, mapped onto our own state names. */
const VERDICT: Readonly<Record<string, 'paid' | 'failed' | 'expired' | 'cancelled'>> = {
  SUCCESS: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  TIMEOUT: 'failed',
  CANCELLED: 'cancelled',
  ABORTED: 'cancelled',
};

/**
 * Applies a new state to the payment session and, when the payment is paid,
 * to the order it belongs to.
 *
 * The order is updated only on a clean `paid`. `requires_review` and
 * `verification_failed` deliberately leave `orders.payment_status` alone rather
 * than writing a state the Airpay-oriented order model does not mean the same
 * way — the SabPaisa session row carries the detail, and the order stays
 * unfulfilled, which is the safe default.
 */
const persist = async (
  row: PaymentRow,
  status: string,
  detail: {
    readonly spTxnId?: string | null;
    readonly paymentMode?: string | null;
    readonly enquiryStatus?: string | null;
  },
): Promise<void> => {
  const paid = status === 'paid';

  await db()
    .from('sabpaisa_payments')
    .update({
      status,
      // Persisted only after verification has succeeded, per the requirement
      // that SabPaisa's transaction id is recorded once — and only once — it
      // has been cross-checked.
      ...(paid && detail.spTxnId != null ? { sp_txn_id: detail.spTxnId } : {}),
      ...(detail.paymentMode != null ? { payment_mode: detail.paymentMode } : {}),
      ...(detail.enquiryStatus != null ? { last_enquiry_status: detail.enquiryStatus } : {}),
      ...(paid ? { verified_at: new Date().toISOString() } : {}),
    })
    .eq('merchant_txn_id', row.merchant_txn_id);

  if (paid) {
    await db()
      .from('orders')
      .update({ payment_status: 'paid', status: 'confirmed' })
      .eq('order_ref', row.order_ref)
      // Guard against a racing reconciler pass overwriting a terminal state.
      .in('payment_status', ['pending', 'initiated']);

    return;
  }

  if (status === 'failed' || status === 'expired' || status === 'cancelled') {
    await db()
      .from('orders')
      .update({ payment_status: status === 'failed' ? 'failed' : 'cancelled' })
      .eq('order_ref', row.order_ref)
      .in('payment_status', ['pending', 'initiated']);
  }
};

/**
 * Verifies and settles one SabPaisa payment by its `merchantTxnId`.
 *
 * `returnClaim` is what the (already signature-verified) return URL asserted.
 * It is used ONLY to detect contradiction — if the signed return says SUCCESS
 * and enquiry disagrees, that is worth flagging rather than silently trusting
 * one channel. It can never by itself produce a `paid`.
 */
export const settleSabPaisaPayment = async (
  merchantTxnId: string,
  returnClaim?: {
    readonly status: string;
    readonly paidAmountPaise: number | null;
  },
): Promise<SabPaisaSettlement> => {
  const { data, error } = await db()
    .from('sabpaisa_payments')
    .select('merchant_txn_id, order_ref, expected_amount_paise, currency, status')
    .eq('merchant_txn_id', merchantTxnId)
    .maybeSingle();

  /*
   * No local record means we have nothing to compare against, so there is no
   * basis on which this could ever be called paid. A reference we did not mint
   * is not a payment we can recognise.
   */
  if (error !== null || data === null) {
    log.warn('sabpaisa.settle.unknown_transaction', { merchantTxnId });

    return { outcome: 'unknown_transaction', merchantTxnId, orderRef: null, status: null };
  }

  const row = data as unknown as PaymentRow;

  if (isTerminal(row.status)) {
    return {
      outcome: 'already_settled',
      merchantTxnId,
      orderRef: row.order_ref,
      status: row.status,
    };
  }

  const enquiry: EnquiryResult = await enquireTransaction(merchantTxnId);

  /*
   * Enquiry gave no usable answer. This is NOT a failure — money may well have
   * moved. The session goes to `unconfirmed`, the order stays unfulfilled, and
   * the reconciler will ask again. Translating this into FAILED would tell a
   * paying customer their payment failed; into SUCCESS, would ship goods for
   * nothing.
   */
  if (enquiry.kind === 'unknown') {
    await persist(row, 'unconfirmed', { enquiryStatus: `unknown:${enquiry.reason}` });

    log.warn('sabpaisa.settle.unconfirmed', {
      merchantTxnId,
      orderRef: row.order_ref,
      reason: enquiry.reason,
    });

    return { outcome: 'unconfirmed', merchantTxnId, orderRef: row.order_ref, status: null };
  }

  const verdict = VERDICT[enquiry.status];

  // An unrecognised status is not assumed to be either good or bad.
  if (verdict === undefined) {
    await persist(row, 'unconfirmed', { enquiryStatus: enquiry.status });

    log.warn('sabpaisa.settle.unrecognised_status', {
      merchantTxnId,
      orderRef: row.order_ref,
      enquiryStatus: enquiry.status,
    });

    return {
      outcome: 'unconfirmed',
      merchantTxnId,
      orderRef: row.order_ref,
      status: enquiry.status,
    };
  }

  // ── A non-success verdict needs no cross-check; nothing is being granted. ──
  if (verdict !== 'paid') {
    await persist(row, verdict, {
      paymentMode: enquiry.paymentMode,
      enquiryStatus: enquiry.status,
    });

    log.info('sabpaisa.settle.terminal', {
      merchantTxnId,
      orderRef: row.order_ref,
      outcome: verdict,
    });

    return { outcome: verdict, merchantTxnId, orderRef: row.order_ref, status: enquiry.status };
  }

  // ── SUCCESS. Every authoritative value must agree before money is honoured. ──
  const env = sabpaisaEnv();
  const mismatches: string[] = [];

  if (enquiry.merchantTxnId !== null && enquiry.merchantTxnId !== row.merchant_txn_id) {
    mismatches.push('merchantTxnId');
  }

  // Compared in paise as integers. `null` is itself a mismatch: an amount we
  // could not read is not an amount we can agree with.
  if (enquiry.amountPaise === null || enquiry.amountPaise !== row.expected_amount_paise) {
    mismatches.push('amount');
  }

  if (enquiry.currency !== null && enquiry.currency !== row.currency.toUpperCase()) {
    mismatches.push('currency');
  }

  // Merchant identity: enquiry echoes the clientCode it answered for, and it
  // must be ours. A response for another merchant is not evidence about us.
  if (enquiry.clientCode !== null && enquiry.clientCode !== env.SABPAISA_CLIENT_CODE) {
    mismatches.push('clientCode');
  }

  /*
   * A signed return that disagrees with enquiry on the sum actually paid.
   * Enquiry stays authoritative, so this does not change the amount check
   * above — it is recorded because a discrepancy between two SabPaisa channels
   * deserves a human's attention either way.
   */
  if (
    returnClaim !== undefined &&
    returnClaim.paidAmountPaise !== null &&
    returnClaim.paidAmountPaise !== row.expected_amount_paise
  ) {
    mismatches.push('returnPaidAmount');
  }

  if (mismatches.length > 0) {
    await persist(row, 'requires_review', {
      paymentMode: enquiry.paymentMode,
      enquiryStatus: enquiry.status,
    });

    /*
     * Non-secret identifiers and field NAMES only. The mismatching values are
     * not logged: pairing an amount with an order reference in a log sink is
     * more order detail than a debugging line needs, and the values are one
     * authenticated dashboard lookup away.
     */
    log.error('sabpaisa.settle.mismatch', {
      merchantTxnId,
      orderRef: row.order_ref,
      mismatchedFields: mismatches.join(','),
      enquiryStatus: enquiry.status,
    });

    return {
      outcome: 'requires_review',
      merchantTxnId,
      orderRef: row.order_ref,
      status: enquiry.status,
    };
  }

  await persist(row, 'paid', {
    spTxnId: enquiry.spTxnId,
    paymentMode: enquiry.paymentMode,
    enquiryStatus: enquiry.status,
  });

  log.info('sabpaisa.settle.paid', { merchantTxnId, orderRef: row.order_ref });

  return { outcome: 'paid', merchantTxnId, orderRef: row.order_ref, status: enquiry.status };
};
