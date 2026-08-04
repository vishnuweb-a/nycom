import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/product';

/**
 * Product data access. No component may query Supabase directly.
 *
 * Every function throws on failure so callers handle one error path, and every
 * function takes an optional `AbortSignal` so it can be passed straight to
 * `useAsyncData` and cancelled on unmount.
 */

/** Columns the storefront reads. Explicit so a schema addition never silently bloats a response. */
const PRODUCT_COLUMNS = `
  id, title, subtitle, ribbon, description, images, thumbnail,
  price, discount_price, sku, weight_grams, track_quantity,
  category, gender, brand, collection, season, material, occasion,
  variants, rating, review_count,
  featured, top_selling, new_arrival, trending, active,
  slug, meta_title, meta_description,
  tags, created_at, updated_at
`;

/** Homepage rails show at most one full grid row on desktop, two on tablet. */
const RAIL_LIMIT = 8;

const runQuery = async (
  flag: 'featured' | 'top_selling' | 'new_arrival',
  signal?: AbortSignal,
): Promise<readonly Product[]> => {
  let query = supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('active', true)
    .eq(flag, true)
    .order('created_at', { ascending: false })
    .limit(RAIL_LIMIT);

  if (signal !== undefined) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.overrideTypes<Product[]>();

  if (error) {
    throw new Error(`Failed to load ${flag.replace('_', ' ')} products: ${error.message}`);
  }

  return data ?? [];
};

/** Products flagged for the homepage Featured rail. */
export const getFeaturedProducts = (signal?: AbortSignal): Promise<readonly Product[]> =>
  runQuery('featured', signal);

/** Products flagged as best sellers. */
export const getTopSellingProducts = (signal?: AbortSignal): Promise<readonly Product[]> =>
  runQuery('top_selling', signal);
