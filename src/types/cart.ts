/**
 * A single cart line.
 *
 * Deliberately a flat snapshot rather than a product reference: the cart must
 * render instantly on load without waiting on a network round trip, and it must
 * survive a product being edited or deactivated between sessions. Prices are
 * re-validated against the catalogue at checkout, not on every render.
 *
 * `thumbnail` holds the Cloudinary `secure_url`; transformations are applied at
 * render time by `cloudinaryUrlFromSrc`.
 */
export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  thumbnail: string;
  brand: string;
  selectedSize: string;
  quantity: number;
  /** Full price before discount, per unit. The struck-through figure. */
  unitPrice: number;
  /** Price actually charged per unit. Equals `unitPrice` when not discounted. */
  discountPrice: number;
  /** Units available for this size, used to clamp quantity. */
  stock: number;
}

/** Item-level money, recomputed from the lines on every change. */
export interface CartTotals {
  /** Total units across every line — the header badge figure. */
  itemCount: number;
  /** Number of distinct lines. */
  lineCount: number;
  /** Sum of `unitPrice × quantity` — the pre-discount total. */
  subtotal: number;
  /** Sum of `discountPrice × quantity` — the amount payable for goods. */
  total: number;
  /** `subtotal − total`. */
  savings: number;
}

/**
 * Outcome of an add attempt, so the caller can give accurate feedback rather
 * than assuming success.
 */
export type CartAddResult =
  | 'added'
  | 'increased'
  /** Capped at available stock — the requested quantity was not fully applied. */
  | 'clamped'
  /** Nothing available in that size. */
  | 'unavailable';

export interface CartContextValue {
  readonly items: readonly CartItem[];
  readonly totals: CartTotals;
  /** Adds a line, or increases it when the product and size already exist. */
  readonly addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => CartAddResult;
  readonly updateQuantity: (productId: string, selectedSize: string, quantity: number) => void;
  readonly removeItem: (productId: string, selectedSize: string) => void;
  readonly clearCart: () => void;
  /** Units of a given product and size currently in the cart. */
  readonly quantityOf: (productId: string, selectedSize: string) => number;
}
