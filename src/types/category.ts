import type { CloudinaryAsset } from '@/types/product';

/** A shopping category, mirroring the `categories` table. */
export interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly cover_image: CloudinaryAsset | null;
  readonly display_order: number;
  readonly active: boolean;
  readonly created_at: string;
}
