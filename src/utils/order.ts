import { estimatedDeliveryRange } from '@/constants/commerce';
import type { OrderSummary, ReconciledLine } from '@/types/cart';
import type { Order, PaymentMethod, ShippingAddress } from '@/types/order';

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

/** Optional overrides for an online order, whose identity is server-assigned. */
export interface OrderOverrides {
  readonly paymentMethod?: PaymentMethod | undefined;
  /** The server-generated `order_ref`; keeps one identifier across both systems. */
  readonly id?: string | undefined;
  readonly paymentStatus?: Order['paymentStatus'];
  readonly accessToken?: string | undefined;
}

/**
 * Builds a complete order from validated checkout state.
 *
 * Defaults to Cash on Delivery with a locally generated id, which is the
 * pre-existing behaviour and is unchanged. Online orders pass the reference and
 * status the server assigned, because for those the server — not this function
 * — is the authority.
 *
 * The money figures come from `summary`, which the storefront derived for
 * display. For an online order the amount actually charged is the one the
 * server computed independently in `api/_lib/pricing.ts`; this copy is a
 * receipt for the shopper, never an input to a payment.
 */
export const buildOrder = (
  lines: readonly ReconciledLine[],
  summary: OrderSummary,
  address: ShippingAddress,
  overrides: OrderOverrides = {},
): Order => ({
  id: overrides.id ?? generateOrderId(),
  createdAt: new Date().toISOString(),
  status: 'pending',
  paymentMethod: overrides.paymentMethod ?? 'cod',
  ...(overrides.paymentStatus === undefined ? {} : { paymentStatus: overrides.paymentStatus }),
  ...(overrides.accessToken === undefined ? {} : { accessToken: overrides.accessToken }),
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
