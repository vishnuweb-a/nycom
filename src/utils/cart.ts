import type { CartItem, CartTotals } from '@/types/cart';
import { effectivePrice, type Product } from '@/types/product';

/**
 * Pure cart calculations. No React, no storage — so the rules stay testable and
 * the provider holds only wiring.
 */

/**
 * Identity of a cart line.
 *
 * A product in two sizes is two lines, so identity is the pair. Product id
 * alone would silently merge a size M and a size L into one row.
 */
export const isSameLine = (item: CartItem, productId: string, selectedSize: string): boolean =>
  item.productId === productId && item.selectedSize === selectedSize;

/** Constrains a requested quantity to what can actually be bought. */
export const clampQuantity = (quantity: number, stock: number): number =>
  Math.max(0, Math.min(Math.floor(quantity), Math.max(0, stock)));

/** Recomputes every money figure from the lines. */
export const calculateTotals = (items: readonly CartItem[]): CartTotals => {
  let itemCount = 0;
  let subtotal = 0;
  let total = 0;

  for (const item of items) {
    itemCount += item.quantity;
    subtotal += item.unitPrice * item.quantity;
    total += item.discountPrice * item.quantity;
  }

  return {
    itemCount,
    lineCount: items.length,
    subtotal,
    total,
    savings: subtotal - total,
  };
};

/**
 * Builds a cart line from a catalogue product and a chosen size.
 *
 * Keeps the Product-to-CartItem mapping in one place so no component has to
 * know that `discount_price` is nullable or where the thumbnail URL lives.
 */
export const toCartItem = (
  product: Product,
  selectedSize: string,
): Omit<CartItem, 'quantity'> | null => {
  const variant = product.variants.find((entry) => entry.size === selectedSize);

  if (variant === undefined) {
    return null;
  }

  const image = product.thumbnail ?? product.images[0] ?? null;

  return {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    thumbnail: image?.secure_url ?? '',
    brand: product.brand,
    selectedSize,
    unitPrice: product.price,
    discountPrice: effectivePrice(product),
    stock: variant.stock === 'in_stock' ? variant.quantity : 0,
  };
};
