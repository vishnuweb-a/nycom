import { randomBytes, randomUUID } from 'node:crypto';

import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '../../src/constants/commerce';
import { db } from './db';
import { PublicError } from './http';

/**
 * Server-side re-pricing — the whole security model of this integration.
 *
 * The browser proposes a basket; the server prices it. Everything the client
 * sends about money is discarded: unit prices, the subtotal, the shipping fee
 * and the grand total are all re-derived from the `products` table on every
 * request. A client that submits a ₹1 total for a ₹5,000 basket gets charged
 * ₹5,000, because its total was never read in the first place.
 *
 * The shipping rules are imported from `src/constants/commerce.ts` rather than
 * restated here, so the figure the storefront quotes and the figure the server
 * charges cannot drift apart.
 */

/** What the browser is allowed to say about a line: what, which size, how many. */
export interface ProposedLine {
  readonly productId: string;
  readonly size: string;
  readonly quantity: number;
}

/** A priced line, snapshotted from the catalogue at order time. */
export interface PricedItem {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  readonly thumbnail: string;
  readonly brand: string;
  readonly size: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPrice: number;
}

export interface PricedOrder {
  readonly items: readonly PricedItem[];
  readonly subtotal: number;
  readonly savings: number;
  readonly shipping: number;
  /** The figure sent to Airpay and stored as `orders.amount`. */
  readonly grandTotal: number;
}

/** Bounds, so a malformed or hostile basket cannot become an expensive query. */
const MAX_LINES = 50;
const MAX_QUANTITY_PER_LINE = 20;

interface ProductRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly brand: string;
  readonly price: number;
  readonly discount_price: number | null;
  readonly images: readonly { readonly secure_url?: string }[] | null;
  readonly thumbnail: { readonly secure_url?: string } | null;
  readonly variants:
    | readonly { readonly size?: string; readonly quantity?: number; readonly stock?: string }[]
    | null;
}

/** Rounds to paisa. Float arithmetic must not leave ₹1499.0000000002 in a total. */
const toPaisa = (value: number): number => Math.round(value * 100) / 100;

/**
 * Prices a proposed basket against the live catalogue.
 *
 * Unlike the storefront's `reconcileCart`, which keeps unavailable lines
 * visible so the shopper can see what changed, this rejects the whole request
 * if any line cannot be bought. At the point of taking money, charging for a
 * partially-fulfillable basket without the shopper re-confirming would be
 * worse than sending them back to the cart.
 */
export const priceOrder = async (lines: readonly ProposedLine[]): Promise<PricedOrder> => {
  if (lines.length === 0) {
    throw new PublicError(400, 'empty_cart', 'Your cart is empty.');
  }

  if (lines.length > MAX_LINES) {
    throw new PublicError(400, 'cart_too_large', 'Your cart has too many items to check out.');
  }

  const productIds = [...new Set(lines.map((line) => line.productId))];

  const { data, error } = await db()
    .from('products')
    .select('id, slug, title, brand, price, discount_price, images, thumbnail, variants')
    .in('id', productIds)
    .eq('active', true);

  if (error) {
    throw new PublicError(
      503,
      'catalogue_unavailable',
      'We could not confirm current prices. Please try again in a moment.',
    );
  }

  const rows = (data ?? []) as unknown as ProductRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));

  const items: PricedItem[] = [];
  let subtotal = 0;
  let total = 0;

  for (const line of lines) {
    const product = byId.get(line.productId);

    if (product === undefined) {
      throw new PublicError(
        409,
        'item_unavailable',
        'An item in your cart is no longer available. Please review your cart.',
      );
    }

    const variant = (product.variants ?? []).find((entry) => entry.size === line.size);
    const available =
      variant !== undefined && variant.stock === 'in_stock' ? (variant.quantity ?? 0) : 0;

    const quantity = Math.floor(line.quantity);

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
      throw new PublicError(400, 'invalid_quantity', 'Please check the quantities in your cart.');
    }

    if (quantity > available) {
      throw new PublicError(
        409,
        'insufficient_stock',
        'An item in your cart is out of stock. Please review your cart.',
      );
    }

    // The catalogue price wins, always. Nothing the client sent is consulted.
    const unitPrice = Number(product.price);
    const discountPrice =
      product.discount_price === null ? unitPrice : Number(product.discount_price);

    if (!Number.isFinite(unitPrice) || !Number.isFinite(discountPrice) || discountPrice < 0) {
      throw new PublicError(
        503,
        'catalogue_unavailable',
        'We could not confirm current prices. Please try again in a moment.',
      );
    }

    subtotal += unitPrice * quantity;
    total += discountPrice * quantity;

    items.push({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      thumbnail: product.thumbnail?.secure_url ?? product.images?.[0]?.secure_url ?? '',
      brand: product.brand,
      size: line.size,
      quantity,
      unitPrice,
      discountPrice,
    });
  }

  // Identical rule to calculateOrderSummary, over the same imported constants.
  const shipping = total === 0 || total >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const grandTotal = toPaisa(total + shipping);

  if (grandTotal <= 0) {
    throw new PublicError(400, 'invalid_amount', 'This order has nothing payable.');
  }

  return {
    items,
    subtotal: toPaisa(subtotal),
    savings: toPaisa(subtotal - total),
    shipping: toPaisa(shipping),
    grandTotal,
  };
};

/**
 * Generates a merchant order reference, e.g. `YV-MB3K2-7F3A9C21`.
 *
 * The storefront's `generateOrderId` uses `Math.random()`, which is fine for
 * labelling a mock order and unsuitable here: this reference identifies real
 * money and appears in the callback, so it must not be guessable. The tail is
 * crypto-grade entropy; the time-derived prefix keeps references sortable and
 * recognisable in the Airpay dashboard.
 */
export const generateOrderRef = (): string => {
  const time = Date.now().toString(36).toUpperCase().slice(-5);
  const random = randomBytes(4).toString('hex').toUpperCase();

  return `YV-${time}-${random}`;
};

/** Opaque per-order read key for the success page. */
export const generateAccessToken = (): string => randomUUID();

/** Airpay expects a fixed two-decimal amount, e.g. `1499.00`. */
export const formatAmount = (amount: number): string => amount.toFixed(2);
