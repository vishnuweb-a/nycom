import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { CartContext } from '@/context/cartContext';
import { CART_STORAGE_KEY, readCart, writeCart } from '@/lib/cartStorage';
import type { CartAddResult, CartContextValue, CartItem } from '@/types/cart';
import { calculateTotals, clampQuantity, isSameLine } from '@/utils/cart';

type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'quantity'>; quantity: number }
  | { type: 'setQuantity'; productId: string; selectedSize: string; quantity: number }
  | { type: 'remove'; productId: string; selectedSize: string }
  | { type: 'clear' }
  /** Adopts state written by another tab. */
  | { type: 'replace'; items: CartItem[] };

/**
 * All cart mutations, in one place.
 *
 * Every path clamps to available stock, so no combination of actions can put
 * the cart into a state the warehouse cannot fulfil.
 */
const cartReducer = (state: CartItem[], action: CartAction): CartItem[] => {
  switch (action.type) {
    case 'add': {
      const existing = state.find((item) =>
        isSameLine(item, action.item.productId, action.item.selectedSize),
      );

      const requested = (existing?.quantity ?? 0) + action.quantity;
      const next = clampQuantity(requested, action.item.stock);

      if (next === 0) {
        return state;
      }

      if (existing === undefined) {
        return [...state, { ...action.item, quantity: next }];
      }

      return state.map((item) =>
        isSameLine(item, action.item.productId, action.item.selectedSize)
          ? // Refresh the snapshot so a price or stock change since the item was
            // added is reflected rather than silently kept stale.
            { ...action.item, quantity: next }
          : item,
      );
    }

    case 'setQuantity': {
      const quantity = clampQuantity(action.quantity, Number.POSITIVE_INFINITY);

      if (quantity === 0) {
        return state.filter((item) => !isSameLine(item, action.productId, action.selectedSize));
      }

      return state.map((item) =>
        isSameLine(item, action.productId, action.selectedSize)
          ? { ...item, quantity: clampQuantity(quantity, item.stock) }
          : item,
      );
    }

    case 'remove':
      return state.filter((item) => !isSameLine(item, action.productId, action.selectedSize));

    case 'clear':
      return [];

    case 'replace':
      return action.items;
  }
};

export interface CartProviderProps {
  children: ReactNode;
}

/**
 * Guest cart state.
 *
 * Persisted to localStorage so a reload or an accidental tab close does not
 * lose a basket, and synchronised across tabs so two open windows never
 * disagree about what is in it.
 *
 * The cart is intentionally client-only: the MVP has no authentication, so
 * there is no account to attach a server-side cart to. When auth ships, this
 * provider is where a merge-on-login would hook in.
 */
export const CartProvider = ({ children }: CartProviderProps) => {
  const [items, dispatch] = useReducer(cartReducer, undefined, readCart);

  useEffect(() => {
    writeCart(items);
  }, [items]);

  // Adopt writes from other tabs. The event only fires in *other* documents, so
  // this cannot loop with the write above.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY) {
        dispatch({ type: 'replace', items: readCart() });
      }
    };

    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantity = 1): CartAddResult => {
      if (item.stock <= 0) {
        return 'unavailable';
      }

      // Computed before dispatch so the caller learns what will happen without
      // having to diff the resulting state.
      const existing = items.find((entry) => isSameLine(entry, item.productId, item.selectedSize));
      const already = existing?.quantity ?? 0;
      const applied = clampQuantity(already + quantity, item.stock);

      dispatch({ type: 'add', item, quantity });

      if (applied === already) {
        return 'clamped';
      }

      if (applied < already + quantity) {
        return 'clamped';
      }

      return existing === undefined ? 'added' : 'increased';
    },
    [items],
  );

  const updateQuantity = useCallback(
    (productId: string, selectedSize: string, quantity: number) => {
      dispatch({ type: 'setQuantity', productId, selectedSize, quantity });
    },
    [],
  );

  const removeItem = useCallback((productId: string, selectedSize: string) => {
    dispatch({ type: 'remove', productId, selectedSize });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'clear' });
  }, []);

  const quantityOf = useCallback(
    (productId: string, selectedSize: string) =>
      items.find((item) => isSameLine(item, productId, selectedSize))?.quantity ?? 0,
    [items],
  );

  const totals = useMemo(() => calculateTotals(items), [items]);

  const value = useMemo<CartContextValue>(
    () => ({ items, totals, addItem, updateQuantity, removeItem, clearCart, quantityOf }),
    [items, totals, addItem, updateQuantity, removeItem, clearCart, quantityOf],
  );

  return <CartContext value={value}>{children}</CartContext>;
};
