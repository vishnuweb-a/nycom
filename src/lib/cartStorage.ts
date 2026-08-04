import { z } from 'zod';

import type { CartItem } from '@/types/cart';

/**
 * Cart persistence.
 *
 * The guest cart survives reloads and tab restores, so the storage key is
 * versioned and every read is validated. Data written by an older build with a
 * different shape is discarded rather than trusted — a malformed line would
 * otherwise reach the UI as `undefined` prices.
 *
 * Every access is guarded: `localStorage` throws in Safari private mode and is
 * absent in non-browser contexts.
 */

export const CART_STORAGE_KEY = 'yarnvia.cart.v1';

const cartItemSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  thumbnail: z.string(),
  brand: z.string(),
  selectedSize: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discountPrice: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
});

const cartSchema = z.array(cartItemSchema);

/** Reads the persisted cart, dropping anything that no longer parses. */
export const readCart = (): CartItem[] => {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);

    if (raw === null) {
      return [];
    }

    const parsed = cartSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : [];
  } catch {
    // Unavailable or corrupt storage must never break the app; an empty cart is
    // the safe fallback.
    return [];
  }
};

/** Persists the cart. Failure is non-fatal — the in-memory cart still works. */
export const writeCart = (items: readonly CartItem[]): void => {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded or storage disabled. Nothing actionable for the shopper.
  }
};
