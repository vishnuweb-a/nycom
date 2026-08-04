import type { CloudinaryAsset } from '@/types/product';

/** A hero banner slide, mirroring the `carousel` table. */
export interface CarouselSlide {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly image: CloudinaryAsset;
  readonly button_text: string | null;
  readonly button_link: string | null;
  readonly display_order: number;
  readonly active: boolean;
  readonly created_at: string;
}
