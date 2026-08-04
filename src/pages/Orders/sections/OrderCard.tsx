import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge/OrderStatusBadge';
import { orderDetailPath, productPath } from '@/constants/routes';
import type { Order } from '@/types/order';
import { cloudinaryUrlFromSrc } from '@/utils/cloudinary';
import { formatPrice } from '@/utils/format';
import { formatOrderDate } from '@/utils/order';

export interface OrderCardProps {
  order: Order;
}

/** Thumbnails shown before collapsing into a "+N more" chip. */
const VISIBLE_THUMBNAILS = 3;

/**
 * One order in the history list.
 *
 * Buy Again links back to the first product rather than re-adding to the cart:
 * sizes and stock will have moved on, and the product page is where those get
 * chosen honestly.
 */
export const OrderCard = ({ order }: OrderCardProps) => {
  const visible = order.items.slice(0, VISIBLE_THUMBNAILS);
  const overflow = order.items.length - visible.length;
  const firstItem = order.items[0];

  return (
    <article className="flex flex-col gap-4 rounded-card border border-border p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-heading">{order.id}</h3>
          <p className="text-small text-secondary">Placed on {formatOrderDate(order.createdAt)}</p>
        </div>

        <OrderStatusBadge status={order.status} />
      </div>

      <div className="flex items-center gap-3">
        <ul className="flex shrink-0 gap-2">
          {visible.map((item) => (
            <li key={`${item.productId}-${item.size}`} className="w-14 md:w-16">
              <img
                src={cloudinaryUrlFromSrc(item.thumbnail, { width: 128, aspectRatio: '4:5' })}
                alt={item.title}
                width={64}
                height={80}
                loading="lazy"
                decoding="async"
                className="aspect-4/5 w-full rounded-image bg-placeholder object-cover"
              />
            </li>
          ))}

          {overflow > 0 && (
            <li className="flex aspect-4/5 w-14 items-center justify-center rounded-image bg-surface text-small font-semibold text-secondary md:w-16">
              +{overflow}
            </li>
          )}
        </ul>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-text">
            {firstItem?.title ?? 'Order items'}
          </p>
          <p className="text-small text-secondary">
            {order.items.length} {order.items.length === 1 ? 'item' : 'items'} · Cash on Delivery
          </p>
        </div>
      </div>

      <dl className="grid gap-3 border-t border-border pt-4 xs:grid-cols-2">
        <div>
          <dt className="text-caption text-secondary">Estimated delivery</dt>
          <dd className="text-base font-medium text-text">{order.estimatedDelivery}</dd>
        </div>

        <div className="xs:text-right">
          <dt className="text-caption text-secondary">Order total</dt>
          <dd className="text-h5 font-bold text-heading">{formatPrice(order.grandTotal)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 xs:flex-row">
        <Link
          to={orderDetailPath(order.id)}
          className={buttonVariants({ size: 'sm', fullWidth: true })}
        >
          View order
        </Link>

        {firstItem !== undefined && (
          <Link
            to={productPath(firstItem.slug)}
            className={buttonVariants({ variant: 'secondary', size: 'sm', fullWidth: true })}
          >
            Buy again
          </Link>
        )}
      </div>
    </article>
  );
};
