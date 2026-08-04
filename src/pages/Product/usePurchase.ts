import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/constants/routes';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/useToast';
import type { CartAddResult } from '@/types/cart';
import { isInStock, type Product } from '@/types/product';
import { toCartItem } from '@/utils/cart';

/** Feedback for every outcome the cart can report. */
const ADD_FEEDBACK: Record<CartAddResult, { message: string; tone: 'success' | 'info' | 'error' }> =
  {
    added: { message: 'Added to cart.', tone: 'success' },
    increased: { message: 'Quantity updated.', tone: 'success' },
    clamped: { message: 'Maximum available quantity reached.', tone: 'info' },
    unavailable: { message: 'Currently out of stock.', tone: 'error' },
  };

export interface UsePurchase {
  readonly selectedSize: string | null;
  readonly selectSize: (size: string) => void;
  readonly quantity: number;
  readonly setQuantity: (quantity: number) => void;
  /** Units available for the chosen size; zero until a size is chosen. */
  readonly availableStock: number;
  readonly sizeError: string | undefined;
  readonly soldOut: boolean;
  readonly addToCart: () => void;
  readonly buyNow: () => void;
}

/**
 * Purchase state and cart interaction for one product.
 *
 * Extracted from the panel because the sticky mobile bar drives the same
 * actions; duplicating them would let the two disagree about the selected size.
 *
 * Cart mutation is delegated entirely to CartContext — this hook only decides
 * what to send and how to report the result.
 */
export const usePurchase = (product: Product): UsePurchase => {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const buyableVariants = useMemo(
    () =>
      product.variants.filter((variant) => variant.stock === 'in_stock' && variant.quantity > 0),
    [product.variants],
  );

  // A single-size product needs no choice, so pre-select it rather than
  // demanding a click that has only one possible outcome.
  const [selectedSize, setSelectedSize] = useState<string | null>(() =>
    buyableVariants.length === 1 ? (buyableVariants[0]?.size ?? null) : null,
  );
  const [quantity, setQuantityState] = useState(1);
  const [sizeError, setSizeError] = useState<string | undefined>(undefined);

  const activeVariant = product.variants.find((variant) => variant.size === selectedSize) ?? null;
  const availableStock =
    activeVariant !== null && activeVariant.stock === 'in_stock' ? activeVariant.quantity : 0;

  const selectSize = useCallback((size: string) => {
    setSelectedSize(size);
    setSizeError(undefined);
    // Sizes stock independently, so a quantity valid for one may exceed another.
    setQuantityState(1);
  }, []);

  const setQuantity = useCallback(
    (next: number) => {
      setQuantityState(Math.max(1, Math.min(next, Math.max(1, availableStock))));
    },
    [availableStock],
  );

  const commit = useCallback((): boolean => {
    if (selectedSize === null) {
      setSizeError('Please select a size');
      return false;
    }

    const line = toCartItem(product, selectedSize);

    if (line === null) {
      showToast(ADD_FEEDBACK.unavailable.message, ADD_FEEDBACK.unavailable.tone);
      return false;
    }

    const result = addItem(line, quantity);
    const feedback = ADD_FEEDBACK[result];

    showToast(feedback.message, feedback.tone);

    return result !== 'unavailable';
  }, [addItem, product, quantity, selectedSize, showToast]);

  const addToCart = useCallback(() => {
    commit();
  }, [commit]);

  const buyNow = useCallback(() => {
    if (commit()) {
      void navigate(ROUTES.CART);
    }
  }, [commit, navigate]);

  return {
    selectedSize,
    selectSize,
    quantity,
    setQuantity,
    availableStock,
    sizeError,
    soldOut: !isInStock(product),
    addToCart,
    buyNow,
  };
};
