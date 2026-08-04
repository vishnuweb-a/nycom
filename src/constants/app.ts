/** Static brand and navigation metadata. Never inline these strings in components. */

import { ROUTES } from '@/constants/routes';

export const APP = {
  name: 'Yarnvia',
  tagline: 'Style Woven For Every Generation.',
  description:
    'Shop modern fashion for Men, Women and Children at Yarnvia. Premium quality clothing, fast delivery and easy returns.',
} as const;

/**
 * Primary header navigation — prd.md §6 and §15.
 * Wishlist, Cart, Search and Profile are rendered as icon actions, not nav links.
 */
export const PRIMARY_NAV = [
  { label: 'Home', path: ROUTES.HOME },
  { label: 'Shop', path: ROUTES.SHOP },
  { label: 'My Orders', path: ROUTES.ORDERS },
] as const;

export type NavItem = (typeof PRIMARY_NAV)[number];
