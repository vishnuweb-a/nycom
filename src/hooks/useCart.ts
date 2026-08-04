import { use } from 'react';

import { CartContext } from '@/context/cartContext';
import type { CartContextValue } from '@/types/cart';

/**
 * Access to the cart.
 *
 * Throws when used outside `CartProvider`, so a missing provider fails
 * immediately with a clear message instead of surfacing later as a null
 * dereference in an unrelated component.
 */
export const useCart = (): CartContextValue => {
  const context = use(CartContext);

  if (context === null) {
    throw new Error('useCart must be used within a CartProvider.');
  }

  return context;
};
