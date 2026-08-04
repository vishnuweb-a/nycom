import { Tag } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { estimatedDeliveryRange } from '@/constants/commerce';
import { ROUTES } from '@/constants/routes';
import type { OrderSummary } from '@/types/cart';
import { formatPrice } from '@/utils/format';

export interface OrderSummaryPanelProps {
  summary: OrderSummary;
  itemCount: number;
  /** False when nothing in the cart can actually be bought. */
  canCheckout: boolean;
  /** True while the catalogue check is in flight. */
  isValidating: boolean;
}

/**
 * Price breakdown and the checkout call to action.
 *
 * Every figure comes from `calculateOrderSummary`, which counts only
 * purchasable lines — an unavailable item must never inflate a total the
 * shopper is about to be asked to pay.
 */
export const OrderSummaryPanel = ({
  summary,
  itemCount,
  canCheckout,
  isValidating,
}: OrderSummaryPanelProps) => {
  const couponId = useId();

  // Until the catalogue check resolves the totals are all zero. Rendering "₹0"
  // would be a plausible-looking wrong number, which is worse than showing
  // nothing at all, so money is masked while validating.
  const money = (amount: number) => (isValidating ? '—' : formatPrice(amount));

  return (
    <div className="flex flex-col gap-6 rounded-card border border-border p-4 md:p-6">
      <h2 className="text-h5 text-heading">Order summary</h2>

      <div className="flex flex-col gap-3">
        <div className="flex justify-between text-base text-body">
          <span>
            Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </span>
          <span className="font-medium text-text">{money(summary.subtotal)}</span>
        </div>

        {summary.savings > 0 && !isValidating && (
          <div className="flex justify-between text-base text-success">
            <span>Savings</span>
            <span className="font-medium">−{money(summary.savings)}</span>
          </div>
        )}

        <div className="flex justify-between text-base text-body">
          <span>Shipping</span>
          <span className="font-medium text-text">
            {isValidating ? (
              '—'
            ) : summary.shipping === 0 ? (
              <span className="text-success">Free</span>
            ) : (
              formatPrice(summary.shipping)
            )}
          </span>
        </div>

        <div className="flex justify-between gap-4 text-base text-body">
          <span>Estimated delivery</span>
          <span className="text-right font-medium text-text">{estimatedDeliveryRange()}</span>
        </div>

        {summary.freeShippingShortfall > 0 && !isValidating && (
          <p className="rounded-input bg-primary-light px-3 py-2 text-small text-primary">
            Add {formatPrice(summary.freeShippingShortfall)} more for free shipping.
          </p>
        )}
      </div>

      <hr className="border-border" />

      <div className="flex items-baseline justify-between">
        <span className="text-h5 text-heading">Grand total</span>
        <span className="text-h4 font-bold text-heading">{money(summary.grandTotal)}</span>
      </div>

      {/* Coupon entry is presentation only — no engine exists, and pretending
          otherwise would fail on the first code a shopper tries. */}
      <div className="flex flex-col gap-2 rounded-input bg-surface p-3">
        <label
          htmlFor={couponId}
          className="flex items-center gap-2 text-small font-medium text-text"
        >
          <Tag className="size-4" aria-hidden="true" />
          Have a coupon?
        </label>

        <div className="flex gap-2">
          <input
            id={couponId}
            type="text"
            disabled
            placeholder="Enter code"
            aria-describedby={`${couponId}-hint`}
            className="h-tap min-w-0 flex-1 rounded-input border border-border bg-background px-3 text-base text-text placeholder:text-muted disabled:opacity-60"
          />

          <button
            type="button"
            disabled
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Coming soon
          </button>
        </div>

        <p id={`${couponId}-hint`} className="text-caption text-muted">
          Coupons are not available yet.
        </p>
      </div>

      <Link
        to={ROUTES.CHECKOUT}
        aria-disabled={!canCheckout}
        tabIndex={canCheckout ? undefined : -1}
        onClick={(event) => {
          if (!canCheckout) {
            event.preventDefault();
          }
        }}
        className={buttonVariants({
          fullWidth: true,
          className: canCheckout ? undefined : 'pointer-events-none opacity-50',
        })}
      >
        Proceed to checkout
      </Link>

      {!canCheckout && (
        <p role="alert" className="text-small text-danger">
          Remove the unavailable items to continue.
        </p>
      )}
    </div>
  );
};
