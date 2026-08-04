import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

export interface CartLinkProps {
  className?: string;
}

/**
 * Header cart action.
 *
 * The header renders this twice — once inside the mobile logo row and once in
 * the tablet+ actions cluster — with visibility controlled by `className`. The
 * item-count badge is added in Phase 7 when CartContext exists; showing a
 * hardcoded zero before then would be fiction.
 */
export const CartLink = ({ className }: CartLinkProps) => (
  <Link
    to={ROUTES.CART}
    aria-label="Your cart"
    className={cn(
      'size-tap shrink-0 items-center justify-center rounded-pill text-body transition-colors hover:bg-hover hover:text-primary',
      className,
    )}
  >
    <ShoppingCart className="size-6" aria-hidden="true" />
  </Link>
);
