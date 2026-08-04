/**
 * Mock order domain.
 *
 * Orders are a frontend simulation for this MVP: placed at checkout, persisted
 * to localStorage, and read back by Order Success and My Orders. No order ever
 * touches Supabase. When a real order service arrives, these shapes become the
 * API contract and the storage layer is swapped out.
 */

export interface ShippingAddress {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly landmark: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
}

/** One purchased line, snapshotted at the moment the order was placed. */
export interface OrderItem {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  readonly thumbnail: string;
  readonly brand: string;
  readonly size: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPrice: number;
  /** Stock at placement — lets Buy Again re-add safely; Cart revalidates anyway. */
  readonly stock: number;
}

/** Lifecycle in fulfilment order — prd.md §13. */
export const ORDER_STATUS_SEQUENCE = [
  'pending',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_SEQUENCE)[number] | 'cancelled';

export interface Order {
  readonly id: string;
  readonly createdAt: string;
  readonly status: OrderStatus;
  /** The only payment method this MVP supports. */
  readonly paymentMethod: 'cod';
  readonly address: ShippingAddress;
  readonly items: readonly OrderItem[];
  readonly subtotal: number;
  readonly savings: number;
  readonly shipping: number;
  readonly grandTotal: number;
  /** Human-readable range computed at placement, e.g. "Fri, 7 Aug – Mon, 10 Aug". */
  readonly estimatedDelivery: string;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
