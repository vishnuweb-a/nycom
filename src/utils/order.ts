import { estimatedDeliveryRange } from '@/constants/commerce';
import type { OrderSummary, ReconciledLine } from '@/types/cart';
import type { Order, ShippingAddress } from '@/types/order';

/**
 * Order construction. Pure — persistence lives in `lib/orderStorage.ts`.
 */

/**
 * Generates a display order id such as `YV-MB3K2-8FQ1`.
 *
 * Time-derived prefix keeps ids unique across sessions; the random tail keeps
 * two orders in the same millisecond distinct. Not a database key — this is a
 * human-facing reference for a mock order.
 */
export const generateOrderId = (): string => {
  const time = Date.now().toString(36).toUpperCase().slice(-5);
  const random = Math.random().toString(36).toUpperCase().slice(2, 6);

  return `YV-${time}-${random}`;
};

/** Builds a complete order from validated checkout state. */
export const buildOrder = (
  lines: readonly ReconciledLine[],
  summary: OrderSummary,
  address: ShippingAddress,
): Order => ({
  id: generateOrderId(),
  createdAt: new Date().toISOString(),
  status: 'pending',
  paymentMethod: 'cod',
  address,
  items: lines
    .filter((line) => line.purchasable)
    .map((line) => ({
      productId: line.item.productId,
      slug: line.item.slug,
      title: line.item.title,
      thumbnail: line.item.thumbnail,
      brand: line.item.brand,
      size: line.item.selectedSize,
      quantity: line.item.quantity,
      unitPrice: line.item.unitPrice,
      discountPrice: line.item.discountPrice,
      stock: line.item.stock,
    })),
  subtotal: summary.subtotal,
  savings: summary.savings,
  shipping: summary.shipping,
  grandTotal: summary.grandTotal,
  estimatedDelivery: estimatedDeliveryRange(),
});

/** `2026-08-04T…` → `4 Aug 2026`. */
export const formatOrderDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
