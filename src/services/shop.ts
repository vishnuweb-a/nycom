import { supabase } from '@/lib/supabase';
import { PAGE_SIZE, SORT_CONFIG, STOCK_TAG, TAG_PREFIX } from '@/constants/shop';
import type { Product, ProductVariant } from '@/types/product';
import type { FacetOption, ShopFacets, ShopFilters, ShopResult } from '@/types/shop';

/**
 * Shop listing queries.
 *
 * Filtering, sorting, counting and pagination all happen in Postgres — the
 * client never receives rows it will not render. No component builds a query.
 */

const PRODUCT_COLUMNS = `
  id, title, subtitle, ribbon, description, images, thumbnail,
  price, discount_price, sku, weight_grams, track_quantity,
  category, gender, brand, collection, season, material, occasion,
  variants, rating, review_count,
  featured, top_selling, new_arrival, trending, active,
  slug, meta_title, meta_description,
  tags, created_at, updated_at
`;

/** Columns needed to derive facet options — deliberately excludes heavy fields. */
const FACET_COLUMNS = 'brand, material, tags, variants, effective_price';

/**
 * Upper bound on rows scanned to build facet lists.
 *
 * Adequate for the current catalogue. Past a few thousand products this should
 * become a materialised view or an RPC returning pre-aggregated counts, rather
 * than growing this number.
 */
const FACET_SCAN_LIMIT = 1000;

/**
 * PostgREST's `or=(...)` filter is a bare string, so characters that are part
 * of its grammar must not reach it from user input.
 */
const sanitiseForFilter = (value: string): string =>
  value
    .replace(/[(),.*\\"'{}[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Escapes a value used inside a jsonb `contains` literal. */
const sanitiseForJson = (value: string): string => value.replace(/["\\{}[\]().,]/g, '');

/**
 * The subset of the PostgREST builder this module uses.
 *
 * Structural typing keeps `applyFilters` generic over both the product query
 * and the facet query without dragging in Supabase's deeply parameterised
 * builder type, which exceeds TypeScript's instantiation depth when nested.
 */
interface FilterableQuery<T> {
  eq: (column: string, value: unknown) => T;
  or: (filters: string) => T;
  gte: (column: string, value: unknown) => T;
  lte: (column: string, value: unknown) => T;
  in: (column: string, values: readonly unknown[]) => T;
  contains: (column: string, value: readonly unknown[]) => T;
  overlaps: (column: string, value: readonly unknown[]) => T;
}

interface QueryResult<Row> {
  data: Row[] | null;
  error: { message: string } | null;
  count: number | null;
}

/** The builder surface used after filtering, narrowed to what this module calls. */
interface ShopQuery extends FilterableQuery<ShopQuery> {
  order: (column: string, options: { ascending: boolean }) => ShopQuery;
  range: (from: number, to: number) => ShopQuery;
  limit: (count: number) => ShopQuery;
  abortSignal: (signal: AbortSignal) => ShopQuery;
  overrideTypes: <Row>() => PromiseLike<QueryResult<Row>>;
}

/**
 * Applies every filter that both the listing and the facet query share.
 *
 * @param includeFacetSelections When false, the multi-select facets (brand,
 *   material, colour, size) are skipped. The facet query uses false so that
 *   choosing one brand does not erase the others from the sidebar.
 */
const applyFilters = <T extends FilterableQuery<T>>(
  query: T,
  filters: ShopFilters,
  includeFacetSelections: boolean,
): T => {
  let next = query.eq('active', true);

  if (filters.category !== null) {
    next = next.eq('category', filters.category);
  }

  const term = sanitiseForFilter(filters.search);

  if (term !== '') {
    // Matches title, subtitle, brand and material by substring, plus an exact
    // tag hit so a search for "banarasi" or "jogger" finds tagged products.
    next = next.or(
      [
        `title.ilike.*${term}*`,
        `subtitle.ilike.*${term}*`,
        `brand.ilike.*${term}*`,
        `material.ilike.*${term}*`,
        `tags.cs.{${term}}`,
      ].join(','),
    );
  }

  if (filters.minPrice !== null) {
    next = next.gte('effective_price', filters.minPrice);
  }

  if (filters.maxPrice !== null) {
    next = next.lte('effective_price', filters.maxPrice);
  }

  if (filters.availability !== null) {
    next = next.contains('tags', [STOCK_TAG[filters.availability]]);
  }

  if (!includeFacetSelections) {
    return next;
  }

  if (filters.brands.length > 0) {
    next = next.in('brand', [...filters.brands]);
  }

  if (filters.materials.length > 0) {
    next = next.in('material', [...filters.materials]);
  }

  if (filters.colors.length > 0) {
    next = next.overlaps(
      'tags',
      filters.colors.map((color) => `${TAG_PREFIX.color}${color}`),
    );
  }

  if (filters.sizes.length > 0) {
    next = next.or(
      filters.sizes.map((size) => `variants.cs.[{"size":"${sanitiseForJson(size)}"}]`).join(','),
    );
  }

  return next;
};

/** Fetches one page of products together with the total match count. */
export const getShopProducts = async (
  filters: ShopFilters,
  signal?: AbortSignal,
): Promise<ShopResult> => {
  const sort = SORT_CONFIG[filters.sort];
  const from = (filters.page - 1) * PAGE_SIZE;

  // Narrowed to `ShopQuery` at this boundary: inferring the generic directly
  // from Supabase's builder exceeds TypeScript's instantiation depth (TS2589).
  const base = supabase
    .from('products')
    .select(PRODUCT_COLUMNS, { count: 'exact' }) as unknown as ShopQuery;

  let query = applyFilters(base, filters, true);

  query = query
    .order(sort.column, { ascending: sort.ascending })
    // Stable tiebreaker so paging never repeats or drops a row when the sort
    // column holds duplicates.
    .order('id', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (signal !== undefined) {
    query = query.abortSignal(signal);
  }

  const { data, error, count } = await query.overrideTypes<Product>();

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return { products: data ?? [], total: count ?? 0 };
};

interface FacetRow {
  brand: string;
  material: string | null;
  tags: string[];
  variants: ProductVariant[];
  effective_price: number;
}

const toOptions = (values: Iterable<string>): FacetOption[] =>
  [...new Set(values)]
    .filter((value) => value !== '')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((value) => ({ value, label: value }));

/** Sizes sort naturally by number and by age band, not alphabetically. */
const sortSizes = (values: Iterable<string>): FacetOption[] =>
  [...new Set(values)]
    .sort((a, b) => {
      const numericA = Number.parseInt(a, 10);
      const numericB = Number.parseInt(b, 10);

      if (!Number.isNaN(numericA) && !Number.isNaN(numericB)) {
        return numericA - numericB;
      }

      return a.localeCompare(b, undefined, { numeric: true });
    })
    .map((value) => ({ value, label: value }));

/** Derives the available filter values for the current result set. */
export const getShopFacets = async (
  filters: ShopFilters,
  signal?: AbortSignal,
): Promise<ShopFacets> => {
  const base = supabase.from('products').select(FACET_COLUMNS) as unknown as ShopQuery;

  let query = applyFilters(base, filters, false).limit(FACET_SCAN_LIMIT);

  if (signal !== undefined) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.overrideTypes<FacetRow>();

  if (error) {
    throw new Error(`Failed to load filters: ${error.message}`);
  }

  const rows = data ?? [];

  const colors = new Set<string>();
  const sizes = new Set<string>();
  let priceFloor = Number.POSITIVE_INFINITY;
  let priceCeiling = 0;
  let hasInStock = false;
  let hasOutOfStock = false;

  for (const row of rows) {
    for (const tag of row.tags) {
      if (tag.startsWith(TAG_PREFIX.color)) {
        colors.add(tag.slice(TAG_PREFIX.color.length));
      } else if (tag === STOCK_TAG.in) {
        hasInStock = true;
      } else if (tag === STOCK_TAG.out) {
        hasOutOfStock = true;
      }
    }

    for (const variant of row.variants) {
      sizes.add(variant.size);
    }

    priceFloor = Math.min(priceFloor, row.effective_price);
    priceCeiling = Math.max(priceCeiling, row.effective_price);
  }

  return {
    brands: toOptions(rows.map((row) => row.brand)),
    materials: toOptions(rows.map((row) => row.material ?? '')),
    colors: toOptions(colors).map((option) => ({
      value: option.value,
      label: option.label.replace(/-/g, ' '),
    })),
    sizes: sortSizes(sizes),
    priceFloor: Number.isFinite(priceFloor) ? Math.floor(priceFloor) : 0,
    priceCeiling: Math.ceil(priceCeiling),
    hasInStock,
    hasOutOfStock,
  };
};
