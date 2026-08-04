import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/commerce';
import type {
  CartItem,
  CartLineIssue,
  CartTotals,
  OrderSummary,
  ReconciledLine,
} from '@/types/cart';
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

/**
 * Checks every cart line against the live catalogue.
 *
 * The catalogue always wins. A basket can be days old, so prices, stock, sizes
 * and even whether a product still exists must be re-derived rather than
 * trusted — otherwise a shopper reaches checkout holding a stale price.
 *
 * Lines that cannot be bought are kept rather than silently dropped, flagged so
 * the shopper can see what changed and remove it themselves. Deleting items
 * behind someone's back is worse than showing them the problem.
 */
export const reconcileCart = (
  items: readonly CartItem[],
  products: readonly Product[],
): ReconciledLine[] =>
  items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);

    if (product === undefined) {
      return { item, issues: [{ type: 'unavailable' }], purchasable: false };
    }

    const variant = product.variants.find((entry) => entry.size === item.selectedSize);

    // Refresh the presentational snapshot regardless of purchasability, so a
    // renamed or re-shot product does not linger with stale copy.
    const livePrice = effectivePrice(product);
    const refreshed: CartItem = {
      ...item,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      thumbnail: product.thumbnail?.secure_url ?? product.images[0]?.secure_url ?? item.thumbnail,
      unitPrice: product.price,
      discountPrice: livePrice,
      stock: variant === undefined || variant.stock !== 'in_stock' ? 0 : variant.quantity,
    };

    const issues: CartLineIssue[] = [];

    if (item.discountPrice !== livePrice) {
      issues.push({ type: 'price-changed', from: item.discountPrice, to: livePrice });
    }

    if (variant === undefined) {
      issues.push({ type: 'size-unavailable' });
      return { item: refreshed, issues, purchasable: false };
    }

    if (refreshed.stock === 0) {
      issues.push({ type: 'out-of-stock' });
      return { item: refreshed, issues, purchasable: false };
    }

    if (item.quantity > refreshed.stock) {
      issues.push({ type: 'quantity-reduced', from: item.quantity, to: refreshed.stock });

      return {
        item: { ...refreshed, quantity: refreshed.stock },
        issues,
        purchasable: true,
      };
    }

    return { item: refreshed, issues, purchasable: true };
  });

/** True when reconciliation actually changed something worth committing. */
export const hasCorrections = (lines: readonly ReconciledLine[]): boolean =>
  lines.some((line) => line.issues.length > 0);

/**
 * Order-level money.
 *
 * Only purchasable lines contribute: an unavailable item must never inflate a
 * total the shopper is about to be asked to pay.
 */
export const calculateOrderSummary = (lines: readonly ReconciledLine[]): OrderSummary => {
  const payable = lines.filter((line) => line.purchasable).map((line) => line.item);
  const { subtotal, total, savings } = calculateTotals(payable);

  const shipping = total === 0 || total >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  return {
    subtotal,
    savings,
    shipping,
    grandTotal: total + shipping,
    freeShippingShortfall: Math.max(0, FREE_SHIPPING_THRESHOLD - total),
  };
};
