import { z } from 'zod';

import { ORDER_STATUS_SEQUENCE, type Order } from '@/types/order';

/**
 * Mock-order persistence, mirroring the cart's storage discipline: versioned
 * key, every read validated, every access guarded. Orders written by an older
 * build with a different shape are discarded rather than trusted.
 */

export const ORDERS_STORAGE_KEY = 'yarnvia.orders.v1';

const addressSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  landmark: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
});

const orderItemSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  thumbnail: z.string(),
  brand: z.string(),
  size: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discountPrice: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
});

const orderSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  status: z.enum([...ORDER_STATUS_SEQUENCE, 'cancelled']),
  // Widened from z.literal('cod') for the Airpay integration. Backward
  // compatible: orders written by an earlier build still parse, so upgrading
  // does not wipe a shopper's history.
  paymentMethod: z.enum(['cod', 'airpay']),
  paymentStatus: z
    .enum(['pending', 'initiated', 'paid', 'failed', 'cancelled', 'requires_review'])
    .optional(),
  accessToken: z.string().optional(),
  address: addressSchema,
  items: z.array(orderItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  savings: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  grandTotal: z.number().nonnegative(),
  estimatedDelivery: z.string(),
});

const ordersSchema = z.array(orderSchema);

/** Reads every stored order, newest first. Corrupt data yields an empty list. */
export const readOrders = (): Order[] => {
  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);

    if (raw === null) {
      return [];
    }

    const parsed = ordersSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

/** Prepends a new order. Failure is non-fatal — the in-memory flow continues. */
export const appendOrder = (order: Order): void => {
  try {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify([order, ...readOrders()]));
  } catch {
    // Storage unavailable; Order Success still renders from navigation state.
  }
};

/** Finds one order by id. */
export const findOrder = (orderId: string): Order | null =>
  readOrders().find((order) => order.id === orderId) ?? null;

/**
 * Patches a stored order in place.
 *
 * Used to reconcile the local cache of an online order with the server's
 * authoritative payment status once verification has run. The local copy is
 * never the source of that answer — this only stops My Orders showing
 * "payment pending" for an order the server has since confirmed.
 */
export const updateOrder = (orderId: string, patch: Partial<Order>): void => {
  try {
    const orders = readOrders();
    const index = orders.findIndex((order) => order.id === orderId);

    if (index === -1) {
      return;
    }

    const next = [...orders];
    next[index] = { ...orders[index], ...patch } as Order;

    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable; the server remains authoritative regardless.
  }
};
