import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { ROUTES } from '@/constants/routes';

/**
 * Empty cart state.
 *
 * The illustration is inline SVG built from design tokens rather than an image
 * asset — no extra request, and it recolours with the theme.
 */
export const EmptyCart = () => (
  <div className="flex flex-col items-center gap-6 py-16 text-center">
    <span
      aria-hidden="true"
      className="flex size-28 items-center justify-center rounded-pill bg-primary-light text-primary"
    >
      <ShoppingBag className="size-12" />
    </span>

    <div className="flex flex-col gap-2">
      <h2 className="text-h4 md:text-h3">Your cart is empty.</h2>

      <p className="max-w-md text-lg text-secondary">
        Nothing here yet. Browse the collection and add something you love.
      </p>
    </div>

    <Link to={ROUTES.SHOP} className={buttonVariants()}>
      Continue shopping
    </Link>
  </div>
);
