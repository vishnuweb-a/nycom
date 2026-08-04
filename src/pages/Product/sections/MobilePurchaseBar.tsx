import { Button } from '@/components/buttons/Button';
import type { UsePurchase } from '@/pages/Product/usePurchase';
import { effectivePrice, type Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

export interface MobilePurchaseBarProps {
  product: Product;
  purchase: UsePurchase;
}

/**
 * Sticky purchase bar for mobile.
 *
 * Fixed to the bottom edge and hidden from tablet up, where the purchase panel
 * is always on screen. It deliberately covers the global bottom navigation on
 * this route: stacking two bars would eat a third of a small viewport, and
 * buying is the only job that matters on a product page.
 *
 * Drives the same `usePurchase` instance as the panel, so the size and quantity
 * chosen above are exactly what these buttons submit.
 */
export const MobilePurchaseBar = ({ product, purchase }: MobilePurchaseBarProps) => {
  if (purchase.soldOut) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-modal md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-h5 font-bold text-heading">
            {formatPrice(effectivePrice(product))}
          </span>

          {purchase.selectedSize !== null && (
            <span className="truncate text-caption text-secondary">
              Size {purchase.selectedSize}
            </span>
          )}
        </div>

        <div className="ml-auto flex flex-1 gap-2">
          <Button variant="secondary" size="sm" fullWidth onClick={purchase.addToCart}>
            Add
          </Button>

          <Button size="sm" fullWidth onClick={purchase.buyNow}>
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
};
