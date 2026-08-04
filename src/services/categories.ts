import { supabase } from '@/lib/supabase';
import type { Category } from '@/types/category';

/** Active categories in display order. */
export const getCategories = async (signal?: AbortSignal): Promise<readonly Category[]> => {
  let query = supabase
    .from('categories')
    .select('id, name, slug, description, cover_image, display_order, active, created_at')
    .eq('active', true)
    .order('display_order', { ascending: true });

  if (signal !== undefined) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.overrideTypes<Category[]>();

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }

  return data ?? [];
};
