import {
  BadgeIndianRupee,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  XCircle,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { orderDetailPath, ROUTES } from '@/constants/routes';
import { useCart } from '@/hooks/useCart';
import { readOrders } from '@/lib/orderStorage';
import {
  useOnlinePaymentStatus,
  type OnlinePaymentState,
} from '@/pages/OrderSuccess/useOnlinePaymentStatus';
import { ORDER_STATUS_LABEL, type Order } from '@/types/order';
import { formatPrice } from '@/utils/format';

interface SuccessState {
  orderId?: string;
}

/**
 * Post-purchase confirmation.
 *
 * Two paths, and the difference between them matters:
 *
 * - **Cash on Delivery** is settled the moment it is placed — nothing has to be
 *   verified, so the page renders success directly from storage, exactly as it
 *   did before this integration.
 *
 * - **Online** arrives via a redirect from Airpay, which proves nothing. The
 *   page opens in a "confirming payment" state and asks the server for the
 *   verified status. It renders success only when the server, having called
 *   Airpay's Order Confirmation API, says the payment is `paid`.
 */
const OrderSuccessPage = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const state = location.state as SuccessState | null;

  // Set by /api/payments/return. Their presence is what marks this an online
  // order; without them, this is the original COD flow.
  const orderRef = searchParams.get('ref');
  const accessToken = searchParams.get('t');
  const isOnline = orderRef !== null && accessToken !== null;

  const payment = useOnlinePaymentStatus(isOnline ? orderRef : null, isOnline ? accessToken : null);

  const { clearCart } = useCart();

  /*
   * Checkout leaves the cart intact when sending the shopper to the gateway, so
   * an abandoned or failed payment can be retried. Confirmed payment is the
   * point at which those items are genuinely bought, so that is where the cart
   * is emptied — not on the redirect, and never on a failure.
   */
  useEffect(() => {
    if (isOnline && payment.kind === 'paid') {
      clearCart();
    }
  }, [isOnline, payment.kind, clearCart]);

  const orders = readOrders();

  const order = isOnline
    ? orders.find((entry) => entry.id === orderRef)
    : state?.orderId === undefined
      ? orders[0]
      : orders.find((entry) => entry.id === state.orderId);

  // An online return with no local copy is still a real order — the shopper may
  // have paid from a different browser, or cleared storage mid-payment. Show the
  // payment outcome rather than bouncing them home with nothing.
  if (order === undefined && !isOnline) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  if (isOnline && payment.kind !== 'paid') {
    return <OnlinePaymentPending state={payment} orderRef={orderRef} order={order} />;
  }

  if (order === undefined) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <ConfirmedOrder order={order} online={isOnline} />;
};

// ─── Success ────────────────────────────────────────────────────────────────

const ConfirmedOrder = ({ order, online }: { order: Order; online: boolean }) => {
  const facts = [
    { icon: Package, label: 'Order ID', value: order.id },
    { icon: CalendarDays, label: 'Estimated delivery', value: order.estimatedDelivery },
    {
      icon: BadgeIndianRupee,
      label: 'Payment method',
      value: online ? 'Paid online' : 'Cash on Delivery',
    },
    { icon: Clock, label: 'Order status', value: ORDER_STATUS_LABEL[order.status] },
  ] as const;

  return (
    <Container className="flex flex-col items-center gap-8 py-12 text-center md:py-20">
      <div className="flex animate-rise-in flex-col items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-24 items-center justify-center rounded-pill bg-success/10 text-success md:size-28"
        >
          <CheckCircle2 className="size-14 md:size-16" strokeWidth={1.5} />
        </span>

        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold tracking-wide text-success uppercase">Thank you</p>

          <h1 className="text-h3 md:text-h1">
            {online ? 'Payment successful' : 'Order successfully placed'}
          </h1>

          <p className="mx-auto max-w-lg text-lg text-secondary">
            {online
              ? "We've received your payment and confirmed your order. It will be on its way shortly."
              : "We've received your order and will send it on its way shortly. Keep the exact amount ready for the delivery partner."}
          </p>
        </div>
      </div>

      <dl className="grid w-full max-w-2xl gap-4 xs:grid-cols-2">
        {facts.map((fact) => {
          const Icon = fact.icon;

          return (
            <div
              key={fact.label}
              className="flex items-center gap-3 rounded-card border border-border p-4 text-left"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <dt className="text-caption text-secondary">{fact.label}</dt>
                <dd className="truncate text-base font-semibold text-heading">{fact.value}</dd>
              </div>
            </div>
          );
        })}
      </dl>

      <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-card bg-surface p-4">
        <span className="text-small text-secondary">
          {online ? 'Amount paid' : 'Amount payable on delivery'}
        </span>
        <span className="text-h3 font-bold text-heading">{formatPrice(order.grandTotal)}</span>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 xs:flex-row">
        <Link
          to={ROUTES.SHOP}
          className={buttonVariants({ variant: 'secondary', fullWidth: true })}
        >
          Continue shopping
        </Link>

        <Link to={orderDetailPath(order.id)} className={buttonVariants({ fullWidth: true })}>
          View my orders
        </Link>
      </div>
    </Container>
  );
};

// ─── Everything that is not yet a confirmed success ─────────────────────────

interface PendingProps {
  readonly state: OnlinePaymentState;
  readonly orderRef: string | null;
  readonly order: Order | undefined;
}

/**
 * Renders the honest states: still confirming, failed, or unresolved.
 *
 * None of these claims the payment succeeded, and none claims it failed unless
 * the server verified that it did. "Unresolved" is a real answer and is shown
 * as one — a payment that is genuinely still in flight must not be presented as
 * a failure that invites the shopper to pay twice.
 */
const OnlinePaymentPending = ({ state, orderRef, order }: PendingProps) => {
  const amount = order?.grandTotal;

  const presentation = {
    checking: {
      icon: Loader2,
      spin: true,
      tone: 'text-primary',
      background: 'bg-primary-light',
      title: 'Confirming your payment',
      body: "We're verifying your payment with Airpay. This usually takes a few seconds — please don't close this page.",
    },
    unresolved: {
      icon: Clock,
      spin: false,
      tone: 'text-warning',
      background: 'bg-warning/10',
      title: 'Payment still processing',
      body: "Your payment hasn't been confirmed yet. This can happen with UPI and net banking. Don't pay again — we'll email you as soon as it settles, and you can check My Orders at any time.",
    },
    failed: {
      icon: XCircle,
      spin: false,
      tone: 'text-error',
      background: 'bg-error/10',
      title: 'Payment not completed',
      body: 'Your payment did not go through and you have not been charged. Your cart is still available if you would like to try again.',
    },
    'requires-review': {
      icon: Clock,
      spin: false,
      tone: 'text-warning',
      background: 'bg-warning/10',
      title: 'We’re checking your payment',
      body: "Your payment went through, but the amount didn't match your order, so we've paused it for a member of our team to check. Please don't pay again — we'll contact you shortly to put it right.",
    },
    'not-found': {
      icon: XCircle,
      spin: false,
      tone: 'text-error',
      background: 'bg-error/10',
      title: 'Order not found',
      body: 'We could not find that order. If you were charged, please contact us with your payment reference and we will sort it out.',
    },
  }[state.kind === 'paid' ? 'checking' : state.kind];

  const Icon = presentation.icon;

  return (
    <Container className="flex flex-col items-center gap-8 py-12 text-center md:py-20">
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden="true"
          className={`flex size-24 items-center justify-center rounded-pill md:size-28 ${presentation.background} ${presentation.tone}`}
        >
          <Icon
            className={`size-14 md:size-16 ${presentation.spin ? 'animate-spin' : ''}`}
            strokeWidth={1.5}
          />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-h3 md:text-h1">{presentation.title}</h1>

          <p aria-live="polite" role="status" className="mx-auto max-w-lg text-lg text-secondary">
            {presentation.body}
          </p>
        </div>
      </div>

      {(orderRef !== null || amount !== undefined) && (
        <dl className="grid w-full max-w-md gap-4 xs:grid-cols-2">
          {orderRef !== null && (
            <div className="flex flex-col gap-1 rounded-card border border-border p-4 text-left">
              <dt className="text-caption text-secondary">Order reference</dt>
              <dd className="truncate text-base font-semibold text-heading">{orderRef}</dd>
            </div>
          )}

          {amount !== undefined && (
            <div className="flex flex-col gap-1 rounded-card border border-border p-4 text-left">
              <dt className="text-caption text-secondary">Order total</dt>
              <dd className="text-base font-semibold text-heading">{formatPrice(amount)}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex w-full max-w-md flex-col gap-3 xs:flex-row">
        <Link
          to={ROUTES.SHOP}
          className={buttonVariants({ variant: 'secondary', fullWidth: true })}
        >
          Continue shopping
        </Link>

        <Link to={ROUTES.ORDERS} className={buttonVariants({ fullWidth: true })}>
          View my orders
        </Link>
      </div>
    </Container>
  );
};

export default OrderSuccessPage;
