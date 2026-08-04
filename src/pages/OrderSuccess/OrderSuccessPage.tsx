import { BadgeIndianRupee, CalendarDays, CheckCircle2, Clock, Package } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { orderDetailPath, ROUTES } from '@/constants/routes';
import { readOrders } from '@/lib/orderStorage';
import { ORDER_STATUS_LABEL } from '@/types/order';
import { formatPrice } from '@/utils/format';

interface SuccessState {
  orderId?: string;
}

/**
 * Post-purchase confirmation.
 *
 * The order id arrives in navigation state; the order itself is read back from
 * storage so a refresh still works. Reaching this page directly, with no order
 * to celebrate, redirects home rather than showing a hollow success screen.
 */
const OrderSuccessPage = () => {
  const location = useLocation();
  const state = location.state as SuccessState | null;

  const orders = readOrders();
  const order =
    state?.orderId === undefined ? orders[0] : orders.find((entry) => entry.id === state.orderId);

  if (order === undefined) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  const facts = [
    { icon: Package, label: 'Order ID', value: order.id },
    { icon: CalendarDays, label: 'Estimated delivery', value: order.estimatedDelivery },
    { icon: BadgeIndianRupee, label: 'Payment method', value: 'Cash on Delivery' },
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

          <h1 className="text-h3 md:text-h1">Order successfully placed</h1>

          <p className="mx-auto max-w-lg text-lg text-secondary">
            We&apos;ve received your order and will send it on its way shortly. Keep the exact
            amount ready for the delivery partner.
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
        <span className="text-small text-secondary">Amount payable on delivery</span>
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

export default OrderSuccessPage;
