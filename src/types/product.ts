/** A single image stored in Cloudinary. Supabase holds only these references. */
export interface CloudinaryAsset {
  readonly secure_url: string;
  readonly public_id: string;
  readonly width: number;
  readonly height: number;
  /** Descriptive alt text. Never empty for product imagery. */
  readonly alt: string;
}

export type StockStatus = 'in_stock' | 'out_of_stock';

/** One purchasable combination of size and colour. */
export interface ProductVariant {
  readonly size: string;
  readonly color: string;
  readonly quantity: number;
  readonly stock: StockStatus;
}

/**
 * A catalogue product, mirroring the `products` table.
 *
 * Field names match the database columns so the service layer never has to map
 * between two vocabularies for the same concept.
 */
export interface Product {
  readonly id: string;

  // Basic information
  readonly title: string;
  readonly subtitle: string | null;
  readonly ribbon: string | null;
  readonly description: string;
  readonly images: readonly CloudinaryAsset[];
  readonly thumbnail: CloudinaryAsset | null;

  // Pricing
  readonly price: number;
  readonly discount_price: number | null;
  readonly sku: string;
  readonly weight_grams: number | null;
  readonly track_quantity: boolean;

  // Classification
  readonly category: string;
  readonly gender: string;
  readonly brand: string;
  readonly collection: string | null;
  readonly season: string | null;
  readonly material: string | null;
  readonly occasion: string | null;

  // Variants
  readonly variants: readonly ProductVariant[];

  // Social proof
  readonly rating: number;
  readonly review_count: number;

  // Display flags
  readonly featured: boolean;
  readonly top_selling: boolean;
  readonly new_arrival: boolean;
  readonly trending: boolean;
  readonly active: boolean;

  // SEO
  readonly slug: string;
  readonly meta_title: string | null;
  readonly meta_description: string | null;

  // Metadata
  readonly tags: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}

/** The price a shopper actually pays. */
export const effectivePrice = (product: Product): number => product.discount_price ?? product.price;

/** Whole-number discount percentage, or `null` when the product is not reduced. */
export const discountPercent = (product: Product): number | null => {
  if (product.discount_price === null || product.price <= 0) {
    return null;
  }

  const percent = Math.round(((product.price - product.discount_price) / product.price) * 100);

  return percent > 0 ? percent : null;
};

/** Distinct sizes across every variant, in first-seen order. */
export const availableSizes = (product: Product): readonly string[] => [
  ...new Set(product.variants.map((variant) => variant.size)),
];

/** True when at least one variant can be purchased. */
export const isInStock = (product: Product): boolean =>
  product.variants.some((variant) => variant.stock === 'in_stock' && variant.quantity > 0);
