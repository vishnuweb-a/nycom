/**
 * Order domain.
 *
 * Cash on Delivery orders remain a frontend simulation: placed at checkout,
 * persisted to localStorage, never written to Supabase. That path is unchanged.
 *
 * Online (Airpay) orders are different. The server creates the authoritative
 * record in Supabase before the shopper is sent to the gateway, and the copy
 * kept here is only a local cache so My Orders has something to show. For an
 * online order the server is the truth and `paymentStatus` below may be stale;
 * `services/payment.ts` refreshes it from `/api/orders/:ref`.
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

export type PaymentMethod = 'cod' | 'airpay';

/**
 * Payment lifecycle, mirroring `orders.payment_status` in Supabase.
 *
 * `initiated` means the shopper was sent to the gateway and nothing has come
 * back yet — it is emphatically not success. Only server-side verification
 * against Airpay's Order Confirmation API may produce `paid`.
 */
export type PaymentStatus =
  | 'pending'
  | 'initiated'
  | 'paid'
  | 'failed'
  | 'cancelled'
  /**
   * Airpay confirmed a payment whose amount did not match the order. Neither
   * paid nor failed — money may have moved, so it is held for a human.
   */
  | 'requires_review';

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: 'Cash on Delivery',
  airpay: 'Paid online',
};

export interface Order {
  readonly id: string;
  readonly createdAt: string;
  readonly status: OrderStatus;
  readonly paymentMethod: PaymentMethod;
  /**
   * Absent on Cash on Delivery orders, which have nothing to settle before
   * dispatch. Present on online orders, where it is a cached view of the
   * server's figure rather than an authority in its own right.
   */
  readonly paymentStatus?: PaymentStatus | undefined;
  /** Opaque per-order read key, used to poll authoritative status. Online only. */
  readonly accessToken?: string | undefined;
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
