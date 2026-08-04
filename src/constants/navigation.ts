import { Home, Package, ShoppingCart, Store } from 'lucide-react';

import { CATEGORY_LINKS } from '@/constants/categories';
import { ROUTES } from '@/constants/routes';
import type { IconNavLink, NavGroup, SocialLink } from '@/types/navigation';

/**
 * Navigation tables.
 *
 * Every entry resolves to a route that exists. Destinations for features that
 * have not been built — Wishlist and Account — are added alongside those
 * features rather than linked ahead of them, so the UI never produces a 404.
 */

/** Category bar: "Shop All" followed by the three PRD categories. */
export const CATEGORY_NAV_LINKS = [{ label: 'Shop All', path: ROUTES.SHOP }, ...CATEGORY_LINKS];

/** Mobile sticky bottom navigation — design.md → Mobile Behavior. */
export const BOTTOM_NAV_LINKS: readonly IconNavLink[] = [
  { label: 'Home', path: ROUTES.HOME, icon: Home, exact: true },
  { label: 'Shop', path: ROUTES.SHOP, icon: Store },
  { label: 'Orders', path: ROUTES.ORDERS, icon: Package },
  { label: 'Cart', path: ROUTES.CART, icon: ShoppingCart },
];

/** Footer link columns — prd.md §16. */
export const FOOTER_NAV_GROUPS: readonly NavGroup[] = [
  {
    title: 'Shop',
    links: CATEGORY_NAV_LINKS,
  },
  {
    title: 'Your Account',
    links: [
      { label: 'My Orders', path: ROUTES.ORDERS },
      { label: 'Your Cart', path: ROUTES.CART },
    ],
  },
  {
    title: 'Support',
    links: [{ label: 'Contact Us', path: ROUTES.CONTACT }],
  },
];

/** Social profiles — external, opened in a new tab. */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: 'Instagram', href: 'https://instagram.com' },
  { label: 'Facebook', href: 'https://facebook.com' },
  { label: 'YouTube', href: 'https://youtube.com' },
];
