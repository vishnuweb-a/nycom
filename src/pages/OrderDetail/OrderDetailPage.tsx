import { useMemo } from 'react';
import { Link, useParams } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Container } from '@/components/common/Container';
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge/OrderStatusBadge';
import { orderDetailPath, productPath, ROUTES } from '@/constants/routes';
import { findOrder } from '@/lib/orderStorage';
import NotFoundPage from '@/pages/NotFound';
import { OrderTimeline } from '@/pages/OrderDetail/sections/OrderTimeline';
import { cloudinaryUrlFromSrc } from '@/utils/cloudinary';
import { formatPrice } from '@/utils/format';
import { formatOrderDate } from '@/utils/order';

/**
 * A single order — `/orders/:orderId`.
 *
 * Read from local storage; an unknown id renders the production Not Found page.
 * View only: cancellation and invoices need a real order backend, so no control
 * is offered that cannot actually do anything.
 */
const OrderDetailPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useMemo(() => (orderId === undefined ? null : findOrder(orderId)), [orderId]);

  if (order === null) {
    return <NotFoundPage />;
  }

  const { address } = order;

  return (
    <Container className="flex flex-col gap-6 py-6 md:gap-8 md:py-10">
      <Breadcrumb
        items={[
          { label: 'My orders', path: ROUTES.ORDERS },
          { label: order.id, path: orderDetailPath(order.id) },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h4 md:text-h2">{order.id}</h1>
          <p className="text-base text-secondary">
            Placed on {formatOrderDate(order.createdAt)} · Cash on Delivery
          </p>
        </div>

        <OrderStatusBadge status={order.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="order-items"
            className="rounded-card border border-border p-4 md:p-6"
          >
            <h2 id="order-items" className="mb-4 text-h5 text-heading">
              Items in this order
            </h2>

            <ul className="flex flex-col gap-4">
              {order.items.map((item) => (
                <li key={`${item.productId}-${item.size}`} className="flex gap-4">
                  <Link
                    to={productPath(item.slug)}
                    className="w-16 shrink-0 overflow-hidden rounded-image bg-placeholder md:w-20"
                  >
                    <img
                      src={cloudinaryUrlFromSrc(item.thumbnail, { width: 160, aspectRatio: '4:5' })}
                      alt={item.title}
                      width={80}
                      height={100}
                      loading="lazy"
                      decoding="async"
                      className="aspect-4/5 w-full object-cover"
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-caption font-semibold tracking-wide text-primary uppercase">
                      {item.brand}
                    </p>

                    <p className="text-base font-medium text-text">
                      <Link
                        to={productPath(item.slug)}
                        className="rounded-input hover:text-primary"
                      >
                        {item.title}
                      </Link>
                    </p>

                    <p className="mt-1 text-small text-secondary">
                      Size {item.size} · Qty {item.quantity}
                    </p>
                  </div>

                  <span className="text-base font-semibold text-heading">
                    {formatPrice(item.discountPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="order-timeline"
            className="rounded-card border border-border p-4 md:p-6"
          >
            <h2 id="order-timeline" className="mb-5 text-h5 text-heading">
              Order timeline
            </h2>

            <OrderTimeline status={order.status} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="shipping-to"
            className="rounded-card border border-border p-4 md:p-6"
          >
            <h2 id="shipping-to" className="mb-3 text-h5 text-heading">
              Shipping address
            </h2>

            <address className="text-base text-body not-italic">
              <span className="font-medium text-text">
                {address.firstName} {address.lastName}
              </span>
              <br />
              {address.address}
              {address.landmark !== '' && (
                <>
                  <br />
                  {address.landmark}
                </>
              )}
              <br />
              {address.city}, {address.state} {address.pincode}
              <br />
              <span className="mt-2 inline-block text-secondary">
                {address.phone} · {address.email}
              </span>
            </address>
          </section>

          <section
            aria-labelledby="order-payment"
            className="rounded-card border border-border p-4 md:p-6"
          >
            <h2 id="order-payment" className="mb-3 text-h5 text-heading">
              Payment
            </h2>

            <p className="flex items-center gap-2 text-base text-body">
              <span aria-hidden="true">📦</span>
              Cash on Delivery
            </p>

            <p className="mt-1 text-small text-secondary">
              Payable to the delivery partner on arrival.
            </p>
          </section>

          <section
            aria-labelledby="order-summary"
            className="flex flex-col gap-3 rounded-card border border-border p-4 md:p-6"
          >
            <h2 id="order-summary" className="text-h5 text-heading">
              Order summary
            </h2>

            <div className="flex justify-between text-base text-body">
              <span>Subtotal</span>
              <span className="font-medium text-text">{formatPrice(order.subtotal)}</span>
            </div>

            {order.savings > 0 && (
              <div className="flex justify-between text-base text-success">
                <span>Savings</span>
                <span className="font-medium">−{formatPrice(order.savings)}</span>
              </div>
            )}

            <div className="flex justify-between text-base text-body">
              <span>Shipping</span>
              <span className="font-medium">
                {order.shipping === 0 ? (
                  <span className="text-success">Free</span>
                ) : (
                  <span className="text-text">{formatPrice(order.shipping)}</span>
                )}
              </span>
            </div>

            <hr className="border-border" />

            <div className="flex items-baseline justify-between">
              <span className="text-h5 text-heading">Total</span>
              <span className="text-h4 font-bold text-heading">
                {formatPrice(order.grandTotal)}
              </span>
            </div>
          </section>

          <Link
            to={ROUTES.SHOP}
            className={buttonVariants({ variant: 'secondary', fullWidth: true })}
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </Container>
  );
};

export default OrderDetailPage;
