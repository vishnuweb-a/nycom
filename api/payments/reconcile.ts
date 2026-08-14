import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';

import { db } from '../_lib/db.js';
import { serverEnv } from '../_lib/env.js';
import { methodNotAllowed, PublicError, sendJson, withErrorHandling } from '../_lib/http.js';
import { log } from '../_lib/log.js';
import { settleOrder } from '../_lib/settle.js';

/**
 * Scheduled reconciliation — pulls the truth for orders nobody told us about.
 *
 * Defence in depth against an IPN that is missed, delayed, or never delivered.
 *
 * `/api/payments/callback` is Yarnvia's registered IPN endpoint and is expected
 * to fire, but no webhook is guaranteed: deliveries are dropped, retried out of
 * order, or held up by an outage on either side. An order whose notification
 * never arrives must not be stranded at `initiated` while the money sits in the
 * merchant account.
 *
 * What makes recovery possible is that Airpay's Order Confirmation API is a
 * *pull* interface keyed by `orderid` — a value Yarnvia generates and owns — so
 * settlement never actually depends on being told. It can always ask. Two paths
 * already do: this sweep, and the success page polling `/api/orders/:ref`.
 *
 * The distinction that matters is presence. The polling path only runs while a
 * shopper is sitting on the page; this sweep covers the case where nobody is,
 * because they paid and closed the tab.
 *
 * All three routes converge on the same `settleOrder`, so a settlement reached
 * here is verified exactly as strictly as one triggered by the IPN itself.
 *
 * It introduces no new infrastructure — a Vercel Cron entry in `vercel.json`
 * against the existing function runtime. No queue, no Redis, no worker.
 *
 * ⚠ Cadence is plan-limited. The Hobby plan permits cron only once per day, and
 * `vercel.json` is set accordingly (`0 3 * * *`, i.e. 08:30 IST). A shopper who
 * pays and closes the tab may therefore wait up to a day for their order to
 * settle. Shoppers who return to the success page are unaffected — their poll
 * settles immediately. On Pro, a fifteen-minute schedule closes the gap;
 * `MAX_AGE_MS` below is sized to tolerate either cadence.
 */

/** Give the normal paths a chance first; only sweep orders older than this. */
const MIN_AGE_MS = 5 * 60_000;

/**
 * Upper bound on how old an order can be and still be swept.
 *
 * This must comfortably exceed the cron interval, or orders fall through the
 * gap. On the Hobby plan the sweep runs once a day, so a 24-hour window would
 * be exactly one interval wide: an order created shortly after one run could
 * pass 24 hours before the next, drop out of the window, and never be settled
 * at all — the precise failure this endpoint exists to prevent.
 *
 * Seven days gives six spare runs to catch anything missed, and still bounds
 * the query so it cannot degrade into a full-table scan as the store grows.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/**
 * Bounded per invocation, so a backlog cannot exhaust the function timeout.
 *
 * Each order costs one Order Confirmation round trip, so this is the real limit
 * on runtime. At a daily cadence this must absorb a full day of unattended
 * payments; raise it — or raise the cron frequency — if the logged `examined`
 * count starts hitting this ceiling.
 */
const BATCH_SIZE = 50;

interface StaleOrder {
  readonly order_ref: string;
  readonly created_at: string;
}

/**
 * Vercel Cron authenticates with `Authorization: Bearer $CRON_SECRET`.
 *
 * Required rather than optional: this endpoint triggers outbound Order
 * Confirmation calls, so leaving it open would let anyone drive traffic against
 * the live MID.
 */
const authorize = (req: VercelRequest): void => {
  const secret = process.env.CRON_SECRET;

  if (secret === undefined || secret === '') {
    throw new PublicError(503, 'not_configured', 'Reconciliation is not configured.');
  }

  const header = req.headers.authorization ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new PublicError(404, 'not_found', 'Not found.');
  }
};

const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    methodNotAllowed(res, ['GET', 'POST']);

    return;
  }

  authorize(req);

  // Reads AIRPAY_ENV early: on a sandbox MID Order Confirmation cannot work, so
  // sweeping would only produce noise.
  serverEnv();

  const now = Date.now();

  const { data, error } = await db()
    .from('orders')
    .select('order_ref, created_at')
    .eq('payment_method', 'airpay')
    .in('payment_status', ['initiated', 'pending'])
    .lt('created_at', new Date(now - MIN_AGE_MS).toISOString())
    .gt('created_at', new Date(now - MAX_AGE_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error !== null) {
    throw new PublicError(503, 'unavailable', 'Reconciliation could not run.');
  }

  const stale = (data ?? []) as unknown as StaleOrder[];

  const outcomes: Record<string, number> = {};

  for (const order of stale) {
    /*
     * A synthetic payload carrying only the reference. Every other field is
     * empty on purpose: `settleOrder` skips the integrity check when no hash is
     * supplied and decides the outcome purely from Order Confirmation — which is
     * the only authority anyway. Nothing here asserts a status or an amount.
     */
    const result = await settleOrder({
      orderRef: order.order_ref,
      apTransactionId: '',
      amount: '',
      transactionStatus: '',
      message: '',
      secureHash: '',
    });

    outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
  }

  log.info('payment.reconcile.swept', {
    examined: stale.length,
    paid: outcomes.paid ?? 0,
    failed: outcomes.failed ?? 0,
    pending: outcomes.pending ?? 0,
    requiresReview: outcomes.amount_mismatch ?? 0,
  });

  sendJson(res, 200, { examined: stale.length, outcomes });
};

export default withErrorHandling('payment.reconcile', handler);
