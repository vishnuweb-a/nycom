import { shopCategoryPath } from '@/constants/routes';

/**
 * The three shopping categories defined in prd.md §5 and guildline.md → Categories.
 *
 * `slug` is the value used in the `/shop/:category` route and must match the
 * category slug stored in Supabase. Cover imagery is served from Cloudinary and
 * is attached in Phase 10; it is deliberately not referenced here.
 */
export const CATEGORIES = [
  { name: 'Men', slug: 'men' },
  { name: 'Women', slug: 'women' },
  { name: 'Children', slug: 'children' },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

/** Category entries as navigable links, for the category navigation bar. */
export const CATEGORY_LINKS = CATEGORIES.map((category) => ({
  label: category.name,
  path: shopCategoryPath(category.slug),
}));
