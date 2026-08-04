import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/product';

/**
 * Fetches the live catalogue rows behind a set of cart lines.
 *
 * Only the columns reconciliation needs, so validating a basket does not pull
 * descriptions and SEO copy over the wire.
 *
 * Inactive products are deliberately *not* filtered out here — a row that no
 * longer matches simply does not come back, and reconciliation treats a missing
 * row as unavailable. That is the same outcome with one fewer branch.
 */
const VALIDATION_COLUMNS = `
  id, slug, title, brand, price, discount_price,
  images, thumbnail, variants, active
`;

export const getCartProducts = async (
  productIds: readonly string[],
  signal?: AbortSignal,
): Promise<readonly Product[]> => {
  if (productIds.length === 0) {
    return [];
  }

  let query = supabase
    .from('products')
    .select(VALIDATION_COLUMNS)
    .in('id', [...productIds])
    .eq('active', true);

  if (signal !== undefined) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.overrideTypes<Product[]>();

  if (error) {
    throw new Error(`Failed to check cart availability: ${error.message}`);
  }

  return data ?? [];
};
