import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/constants/routes';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/utils/cn';

export interface CartLinkProps {
  className?: string;
}

/** Counts above this render as "9+" so the badge stays inside its circle. */
const MAX_BADGE_COUNT = 9;

/**
 * Header cart action with a live item count.
 *
 * The header renders this twice — once inside the mobile logo row and once in
 * the tablet+ actions cluster — with visibility controlled by `className`.
 *
 * The count is part of the accessible name rather than a bare number, so a
 * screen reader announces "Your cart, 3 items" instead of "Your cart 3".
 */
export const CartLink = ({ className }: CartLinkProps) => {
  const { totals } = useCart();
  const { itemCount } = totals;

  return (
    <Link
      to={ROUTES.CART}
      aria-label={
        itemCount === 0
          ? 'Your cart, empty'
          : `Your cart, ${String(itemCount)} ${itemCount === 1 ? 'item' : 'items'}`
      }
      className={cn(
        'relative size-tap shrink-0 items-center justify-center rounded-pill text-body transition-colors hover:bg-hover hover:text-primary',
        className,
      )}
    >
      <ShoppingCart className="size-6" aria-hidden="true" />

      {itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-pill bg-accent px-1 text-caption font-semibold text-white"
        >
          {itemCount > MAX_BADGE_COUNT ? `${String(MAX_BADGE_COUNT)}+` : itemCount}
        </span>
      )}
    </Link>
  );
};
