import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { ROUTES } from '@/constants/routes';
import { formatPrice } from '@/utils/format';

export interface MobileCheckoutBarProps {
  grandTotal: number;
  canCheckout: boolean;
}

/**
 * Sticky checkout bar for mobile.
 *
 * Fixed to the bottom edge and hidden from tablet up, where the summary panel
 * is always in view. As on the product page it covers the global bottom
 * navigation: on a cart, proceeding is the only action that matters.
 */
export const MobileCheckoutBar = ({ grandTotal, canCheckout }: MobileCheckoutBarProps) => (
  <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-modal md:hidden">
    <div className="flex items-center gap-4">
      <div className="flex flex-col">
        <span className="text-caption text-secondary">Total</span>
        <span className="text-h5 font-bold text-heading">{formatPrice(grandTotal)}</span>
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
          className: canCheckout
            ? 'ml-auto flex-1'
            : 'pointer-events-none ml-auto flex-1 opacity-50',
        })}
      >
        Checkout
      </Link>
    </div>
  </div>
);
