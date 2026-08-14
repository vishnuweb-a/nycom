import { useEffect, useRef, useState } from 'react';

import { updateOrder } from '@/lib/orderStorage';
import { fetchOrderStatus } from '@/services/payment';
import type { PaymentStatus } from '@/types/order';

/**
 * Polls the server for an online order's real payment status.
 *
 * The shopper arriving on this page tells us nothing: Airpay redirects the
 * browser whether the payment succeeded, failed or was abandoned, and the URL
 * can be visited by anyone. So the page starts in `checking` and asks the
 * server, which answers only from verified Order Confirmation data.
 *
 * Polling exists because settlement is asynchronous. The webhook may not have
 * arrived yet, and a UPI payment can legitimately sit `INPROCESS` for a while.
 * Showing "processing" during that window is honest; showing success would not
 * be.
 */

export type OnlinePaymentState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'paid' }
  | { readonly kind: 'failed'; readonly reason: PaymentStatus }
  /**
   * Payment confirmed but for an unexpected amount. Never shown as a failure —
   * the shopper may well have been charged.
   */
  | { readonly kind: 'requires-review' }
  /** Still unsettled when polling gave up — genuinely unknown, not failed. */
  | { readonly kind: 'unresolved' }
  | { readonly kind: 'not-found' };

const POLL_INTERVAL_MS = 3000;

/** ~60 seconds. Past this, a human should look rather than a spinner spin. */
const MAX_ATTEMPTS = 20;

export const useOnlinePaymentStatus = (
  orderRef: string | null,
  accessToken: string | null,
): OnlinePaymentState => {
  const [state, setState] = useState<OnlinePaymentState>({ kind: 'checking' });
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (orderRef === null || accessToken === null) {
      return;
    }

    const controller = new AbortController();
    let timer: number | undefined;
    let cancelled = false;

    const poll = async (): Promise<void> => {
      attemptsRef.current += 1;

      const status = await fetchOrderStatus(orderRef, accessToken, controller.signal);

      if (cancelled) {
        return;
      }

      if (status === null) {
        // A transient failure is not an answer. Keep trying until the budget is
        // spent, then report "unresolved" rather than inventing an outcome.
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setState({ kind: 'unresolved' });

          return;
        }

        timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);

        return;
      }

      if (status.settled) {
        // Reconcile the local cache so My Orders stops saying "pending".
        updateOrder(orderRef, { paymentStatus: status.paymentStatus });

        if (status.paymentStatus === 'paid') {
          setState({ kind: 'paid' });
        } else if (status.paymentStatus === 'requires_review') {
          setState({ kind: 'requires-review' });
        } else {
          setState({ kind: 'failed', reason: status.paymentStatus });
        }

        return;
      }

      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setState({ kind: 'unresolved' });

        return;
      }

      timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      cancelled = true;
      controller.abort();

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [orderRef, accessToken]);

  return state;
};
