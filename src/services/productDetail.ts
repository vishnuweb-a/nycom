import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/product';

/**
 * Single-product queries.
 *
 * Kept apart from `services/shop.ts`, which owns the listing, so the detail
 * page does not pull the facet machinery into its route chunk.
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

/** How many same-category candidates to rank before taking the best four. */
const CANDIDATE_LIMIT = 24;

export const RELATED_LIMIT = 4;

/**
 * Fetches one product by slug.
 *
 * Returns `null` when nothing matches so the page can render Not Found rather
 * than treating a bad URL as a failure to retry.
 */
export const getProductBySlug = async (
  slug: string,
  signal?: AbortSignal,
): Promise<Product | null> => {
  let query = supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('slug', slug)
    .eq('active', true)
    .limit(1);

  if (signal !== undefined) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.overrideTypes<Product[]>();

  if (error) {
    throw new Error(`Failed to load product: ${error.message}`);
  }

  return data?.[0] ?? null;
};

/** Scores a candidate against the product being viewed. Higher is more related. */
const relatednessScore = (candidate: Product, product: Product): number =>
  (candidate.brand === product.brand ? 4 : 0) +
  (candidate.material !== null && candidate.material === product.material ? 2 : 0) +
  (candidate.collection !== null && candidate.collection === product.collection ? 1 : 0);

/**
 * Finds products related to the one being viewed.
 *
 * Priority is same category, then same brand, then same material. PostgREST
 * cannot order by that kind of expression, so a bounded set of same-category
 * candidates is fetched and ranked in memory — one query rather than three
 * sequential round trips.
 *
 * Categories with too little stock top up from the wider catalogue, so the rail
 * is never a lonely single card.
 */
export const getRelatedProducts = async (
  product: Product,
  signal?: AbortSignal,
): Promise<readonly Product[]> => {
  const fetchCandidates = async (sameCategory: boolean) => {
    let query = supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('active', true)
      .neq('id', product.id)
      .limit(CANDIDATE_LIMIT);

    query = sameCategory
      ? query.eq('category', product.category)
      : query.neq('category', product.category);

    if (signal !== undefined) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query.overrideTypes<Product[]>();

    if (error) {
      throw new Error(`Failed to load related products: ${error.message}`);
    }

    return data ?? [];
  };

  const sorted = [...(await fetchCandidates(true))].sort(
    (a, b) => relatednessScore(b, product) - relatednessScore(a, product),
  );

  if (sorted.length >= RELATED_LIMIT) {
    return sorted.slice(0, RELATED_LIMIT);
  }

  const filler = await fetchCandidates(false);

  return [...sorted, ...filler].slice(0, RELATED_LIMIT);
};
