import type { Product } from '@/types/product';

export type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'discount' | 'rating';

export type Availability = 'in' | 'out';

/** The complete Shop listing state, derived entirely from the URL. */
export interface ShopFilters {
  readonly search: string;
  /** From the `/shop/:category` route segment, not the query string. */
  readonly category: string | null;
  readonly brands: readonly string[];
  readonly materials: readonly string[];
  readonly colors: readonly string[];
  readonly sizes: readonly string[];
  readonly availability: Availability | null;
  readonly minPrice: number | null;
  readonly maxPrice: number | null;
  readonly sort: SortKey;
  readonly page: number;
}

/** Which multi-select facet a value belongs to. */
export type FacetKey = 'brands' | 'materials' | 'colors' | 'sizes';

export interface FacetOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Available filter values for the current result set.
 *
 * Computed with category, search, price and availability applied but *not* the
 * multi-select facets themselves, so selecting a brand never removes the other
 * brands from the list — which would leave the shopper unable to change their
 * mind.
 */
export interface ShopFacets {
  readonly brands: readonly FacetOption[];
  readonly materials: readonly FacetOption[];
  readonly colors: readonly FacetOption[];
  readonly sizes: readonly FacetOption[];
  readonly priceFloor: number;
  readonly priceCeiling: number;
  readonly hasInStock: boolean;
  readonly hasOutOfStock: boolean;
}

export interface ShopResult {
  readonly products: readonly Product[];
  readonly total: number;
}
