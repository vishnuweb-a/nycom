/**
 * Canonical route table.
 *
 * Every `<Link>`, redirect and router definition must reference these constants
 * so a path change is a single-file edit and never a string hunt.
 */

export const ROUTES = {
  HOME: '/',
  SHOP: '/shop',
  SHOP_CATEGORY: '/shop/:category',
  PRODUCT: '/product/:id',
  CART: '/cart',
  CHECKOUT: '/checkout',
  ORDER_SUCCESS: '/order-success',
  ORDERS: '/orders',
  CONTACT: '/contact',
  NOT_FOUND: '*',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** Builds `/shop/men` from the parameterised `/shop/:category` pattern. */
export const shopCategoryPath = (categorySlug: string): string =>
  ROUTES.SHOP_CATEGORY.replace(':category', categorySlug);

/** Builds `/product/classic-oxford-shirt` from the `/product/:id` pattern. */
export const productPath = (productId: string): string => ROUTES.PRODUCT.replace(':id', productId);
