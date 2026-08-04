import type { SortKey } from '@/types/shop';

/**
 * Shop listing configuration.
 *
 * Search, filter, sort and page state all live in the query string so a result
 * set is shareable, bookmarkable and survives the back button. Every producer
 * and consumer of that state reads these names — never a literal.
 */

export const SHOP_PARAMS = {
  search: 'q',
  brand: 'brand',
  material: 'material',
  color: 'color',
  size: 'size',
  availability: 'stock',
  minPrice: 'min',
  maxPrice: 'max',
  sort: 'sort',
  page: 'page',
} as const;

/** Multi-select facet values are comma-separated in the URL. */
export const VALUE_SEPARATOR = ',';

export const PAGE_SIZE = 12;

/** Milliseconds to wait after typing stops before the URL updates. */
export const SEARCH_DEBOUNCE_MS = 400;

/**
 * Sort definitions, keyed so a lookup is total and can never be undefined.
 *
 * `column` must be a real database column — PostgREST cannot order by an
 * expression, which is why `effective_price` and `discount_pct` exist as
 * generated columns (see migration 0002).
 */
export const SORT_CONFIG: Record<SortKey, { label: string; column: string; ascending: boolean }> = {
  newest: { label: 'Newest first', column: 'created_at', ascending: false },
  'price-asc': { label: 'Price: low to high', column: 'effective_price', ascending: true },
  'price-desc': { label: 'Price: high to low', column: 'effective_price', ascending: false },
  discount: { label: 'Highest discount', column: 'discount_pct', ascending: false },
  rating: { label: 'Highest rating', column: 'rating', ascending: false },
};

/** Menu order for the sort control. */
export const SORT_ORDER: readonly SortKey[] = [
  'newest',
  'price-asc',
  'price-desc',
  'discount',
  'rating',
];

export const DEFAULT_SORT: SortKey = 'newest';

/** Namespaced tag prefixes. Only this module and the facet parser know them. */
export const TAG_PREFIX = {
  color: 'color:',
  brand: 'brand:',
  material: 'material:',
} as const;

export const STOCK_TAG = {
  in: 'stock:in',
  out: 'stock:out',
} as const;
