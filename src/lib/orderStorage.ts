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
  paymentMethod: z.literal('cod'),
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
