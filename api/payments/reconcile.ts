import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';

import { db } from '../_lib/db';
import { serverEnv } from '../_lib/env';
import { methodNotAllowed, PublicError, sendJson, withErrorHandling } from '../_lib/http';
import { log } from '../_lib/log';
import { settleOrder } from '../_lib/settle';

/**
 * Scheduled reconciliation — pulls the truth for orders nobody told us about.
 *
 * This exists because of a specific architectural fact about this deployment:
 * **Yarnvia cannot assume it will ever receive the Airpay IPN.** Airpay's
 * callback and success URLs are configured per-MID in its dashboard, and on this
 * MID they point at the client's existing infrastructure
 * (`frontiva.online` → `kkchat.in`). No mechanism has been established for that
 * chain to notify Yarnvia, and inventing one is out of scope.
 *
 * The good news is that Airpay's Order Confirmation API is a *pull* interface
 * keyed by `orderid`, which Yarnvia generates and owns. So Yarnvia never
 * actually needs to be told anything — it can always ask. Two things already
 * ask: the success page polling `/api/orders/:ref`, and the callback if one ever
 * arrives. Both require someone to be present.
 *
 * This sweep covers the case where nobody is: the shopper paid and closed the
 * tab, and no callback reached us. Without it those orders would sit at
 * `initiated` forever while the money sat in the merchant account.
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
