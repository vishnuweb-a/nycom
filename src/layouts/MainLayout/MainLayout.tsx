import { Outlet, ScrollRestoration } from 'react-router';

import { CategoryNav } from '@/components/layout/CategoryNav';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

/**
 * Application shell shared by every route.
 *
 * Owns the landmark structure — header, main, footer — plus the skip link that
 * lets keyboard users bypass navigation on every page.
 */
export const MainLayout = () => (
  <div className="flex min-h-screen flex-col bg-background">
    {/*
      A data router does not reset scroll on navigation by default, so opening a
      product from halfway down the Shop grid landed the shopper halfway down
      the product page. This scrolls to top on a new navigation and restores
      position on back/forward, while honouring the `preventScrollReset` the
      Shop listing uses when only its filters change.
    */}
    <ScrollRestoration />

    <a
      href="#main-content"
      className="sr-only rounded-button bg-primary px-4 py-3 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
    >
      Skip to main content
    </a>

    <Header />
    <CategoryNav />

    <main id="main-content" className="flex-1">
      <Outlet />
    </main>

    <Footer />
    <MobileBottomNav />
  </div>
);
