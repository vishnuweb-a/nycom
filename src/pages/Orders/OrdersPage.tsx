import { PackageOpen } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { ROUTES } from '@/constants/routes';
import { readOrders } from '@/lib/orderStorage';
import { OrderCard } from '@/pages/Orders/sections/OrderCard';

/**
 * Order history — prd.md §13.
 *
 * Reads the locally persisted mock orders. Nothing is fetched from Supabase:
 * orders are a frontend simulation for this MVP, so storage is the only source.
 * Because reading is synchronous there is no loading state to render.
 */
const OrdersPage = () => {
  const orders = useMemo(() => readOrders(), []);

  if (orders.length === 0) {
    return (
      <Container className="py-6 md:py-10">
        <h1 className="sr-only">My orders</h1>

        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <span
            aria-hidden="true"
            className="flex size-28 items-center justify-center rounded-pill bg-primary-light text-primary"
          >
            <PackageOpen className="size-12" />
          </span>

          <div className="flex flex-col gap-2">
            <h2 className="text-h4 md:text-h3">No orders yet</h2>

            <p className="max-w-md text-lg text-secondary">
              When you place your first order it will appear here, with its status and delivery
              details.
            </p>
          </div>

          <Link to={ROUTES.SHOP} className={buttonVariants()}>
            Start shopping
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-6 py-6 md:gap-8 md:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-h4 md:text-h2">My orders</h1>
        <p className="text-base text-secondary">
          {orders.length} {orders.length === 1 ? 'order' : 'orders'} placed
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} />
          </li>
        ))}
      </ul>
    </Container>
  );
};

export default OrdersPage;
