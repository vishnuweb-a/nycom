import { supabase } from '@/lib/supabase';
import type { CarouselSlide } from '@/types/carousel';

/** Active hero slides in display order. */
export const getCarouselSlides = async (
  signal?: AbortSignal,
): Promise<readonly CarouselSlide[]> => {
  let query = supabase
    .from('carousel')
    .select(
      'id, title, subtitle, image, button_text, button_link, display_order, active, created_at',
    )
    .eq('active', true)
    .order('display_order', { ascending: true });

  if (signal !== undefined) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.overrideTypes<CarouselSlide[]>();

  if (error) {
    throw new Error(`Failed to load carousel slides: ${error.message}`);
  }

  return data ?? [];
};
