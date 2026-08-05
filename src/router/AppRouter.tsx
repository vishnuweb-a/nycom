import { createBrowserRouter, RouterProvider } from 'react-router';

import { MainLayout } from '@/layouts/MainLayout';
import { RouteErrorBoundary } from '@/router/RouteErrorBoundary';
import { ROUTES } from '@/constants/routes';

/**
 * Application routes.
 *
 * Every page is code-split via `lazy` so the initial bundle carries only the
 * shell plus the landing route. `/shop` and `/shop/:category` intentionally
 * share one module: category is a filter over the same listing UI, not a
 * separate page.
 */
const router = createBrowserRouter([
  {
    element: <MainLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/pages/Home')).default }),
      },
      {
        path: ROUTES.SHOP,
        lazy: async () => ({ Component: (await import('@/pages/Shop')).default }),
      },
      {
        path: ROUTES.SHOP_CATEGORY,
        lazy: async () => ({ Component: (await import('@/pages/Shop')).default }),
      },
      {
        path: ROUTES.PRODUCT,
        lazy: async () => ({ Component: (await import('@/pages/Product')).default }),
      },
      {
        path: ROUTES.CART,
        lazy: async () => ({ Component: (await import('@/pages/Cart')).default }),
      },
      {
        path: ROUTES.CHECKOUT,
        lazy: async () => ({ Component: (await import('@/pages/Checkout')).default }),
      },
      {
        path: ROUTES.ORDER_SUCCESS,
        lazy: async () => ({ Component: (await import('@/pages/OrderSuccess')).default }),
      },
      {
        path: ROUTES.ORDERS,
        lazy: async () => ({ Component: (await import('@/pages/Orders')).default }),
      },
      {
        path: ROUTES.ORDER_DETAIL,
        lazy: async () => ({ Component: (await import('@/pages/OrderDetail')).default }),
      },
      {
        path: ROUTES.CONTACT,
        lazy: async () => ({ Component: (await import('@/pages/Contact')).default }),
      },
      {
        path: ROUTES.PRIVACY,
        lazy: async () => ({ Component: (await import('@/pages/Privacy')).default }),
      },
      {
        path: ROUTES.TERMS,
        lazy: async () => ({ Component: (await import('@/pages/Terms')).default }),
      },
      {
        path: ROUTES.REFUND_POLICY,
        lazy: async () => ({ Component: (await import('@/pages/RefundPolicy')).default }),
      },
      {
        path: ROUTES.NOT_FOUND,
        lazy: async () => ({ Component: (await import('@/pages/NotFound')).default }),
      },
    ],
  },
]);

export const AppRouter = () => <RouterProvider router={router} />;
