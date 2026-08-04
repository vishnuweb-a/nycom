import { Link } from 'react-router';

import { Button } from '@/components/buttons/Button';
import { TrustBadges } from '@/components/common/TrustBadges/TrustBadges';
import { estimatedDeliveryRange } from '@/constants/commerce';
import { productPath } from '@/constants/routes';
import type { OrderSummary, ReconciledLine } from '@/types/cart';
import { cloudinaryUrlFromSrc } from '@/utils/cloudinary';
import { formatPrice } from '@/utils/format';

export interface CheckoutSummaryProps {
  lines: readonly ReconciledLine[];
  summary: OrderSummary;
  itemCount: number;
  /** True while the catalogue check is in flight. */
  isValidating: boolean;
  isPlacing: boolean;
  onPlaceOrder: () => void;
}

/**
 * Order review and the place-order action.
 *
 * Lines are listed compactly rather than as full cart rows — at this point the
 * shopper is confirming, not editing, and the cart is one click away.
 */
export const CheckoutSummary = ({
  lines,
  summary,
  itemCount,
  isValidating,
  isPlacing,
  onPlaceOrder,
}: CheckoutSummaryProps) => (
  <div className="flex flex-col gap-5 rounded-card border border-border p-4 md:p-6">
    <h2 className="text-h5 text-heading">Order summary</h2>

    <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
      {lines
        .filter((line) => line.purchasable)
        .map((line) => (
          <li key={`${line.item.productId}-${line.item.selectedSize}`} className="flex gap-3">
            <Link
              to={productPath(line.item.slug)}
              className="relative w-14 shrink-0 overflow-hidden rounded-image bg-placeholder"
            >
              <img
                src={cloudinaryUrlFromSrc(line.item.thumbnail, { width: 112, aspectRatio: '4:5' })}
                alt={line.item.title}
                width={56}
                height={70}
                loading="lazy"
                decoding="async"
                className="aspect-4/5 w-full object-cover"
              />

              <span className="absolute top-0 right-0 rounded-bl-image bg-heading px-1.5 text-caption font-semibold text-white">
                {line.item.quantity}
              </span>
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-small font-medium text-text">{line.item.title}</p>
              <p className="text-caption text-secondary">Size {line.item.selectedSize}</p>
            </div>

            <span className="text-small font-semibold text-heading">
              {formatPrice(line.item.discountPrice * line.item.quantity)}
            </span>
          </li>
        ))}
    </ul>

    <hr className="border-border" />

    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between text-base text-body">
        <span>
          Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
        </span>
        <span className="font-medium text-text">
          {isValidating ? '—' : formatPrice(summary.subtotal)}
        </span>
      </div>

      {summary.savings > 0 && !isValidating && (
        <div className="flex justify-between text-base text-success">
          <span>Savings</span>
          <span className="font-medium">−{formatPrice(summary.savings)}</span>
        </div>
      )}

      <div className="flex justify-between text-base text-body">
        <span>Shipping</span>
        <span className="font-medium">
          {isValidating ? (
            '—'
          ) : summary.shipping === 0 ? (
            <span className="text-success">Free</span>
          ) : (
            <span className="text-text">{formatPrice(summary.shipping)}</span>
          )}
        </span>
      </div>

      <div className="flex justify-between gap-4 text-base text-body">
        <span>Estimated delivery</span>
        <span className="text-right font-medium text-text">{estimatedDeliveryRange()}</span>
      </div>
    </div>

    <hr className="border-border" />

    <div className="flex items-baseline justify-between">
      <span className="text-h5 text-heading">Grand total</span>
      <span className="text-h4 font-bold text-heading">
        {isValidating ? '—' : formatPrice(summary.grandTotal)}
      </span>
    </div>

    {/* Hidden on mobile, where the sticky bar carries the same action. */}
    <Button
      fullWidth
      onClick={onPlaceOrder}
      isLoading={isPlacing}
      loadingLabel="Placing your order"
      className="hidden md:inline-flex"
    >
      Place Order (Cash on Delivery)
    </Button>

    <TrustBadges />
  </div>
);
