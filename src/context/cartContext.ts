import { createContext } from 'react';

import type { CartContextValue } from '@/types/cart';

/**
 * Cart context object.
 *
 * Kept apart from the provider component so neither file exports both a
 * component and a non-component, which would break React Fast Refresh.
 *
 * `null` is the uninitialised value; `useCart` turns that into a clear error
 * rather than letting a missing provider surface as "cannot read items of null".
 */
export const CartContext = createContext<CartContextValue | null>(null);
