import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useNavigation } from 'react-router';

import { CategoryNav } from '@/components/layout/CategoryNav';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { clearChunkRecoveryFlag } from '@/utils/chunkRecovery';

/**
 * Application shell shared by every route.
 *
 * Owns the landmark structure — header, main, footer — plus the skip link that
 * lets keyboard users bypass navigation on every page.
 */
/**
 * Releases the one-shot chunk-reload guard once a route has actually loaded.
 *
 * Waiting for an idle navigation matters: the shell mounts before a lazy route
 * chunk resolves, so clearing the flag any earlier would re-arm the reload
 * while the stale import could still fail — exactly the loop the guard exists
 * to prevent. By the time navigation is idle the route module has resolved, so
 * this session is proven healthy and a future deploy may recover again.
 */
const ChunkRecoveryReset = () => {
  const { state } = useNavigation();

  useEffect(() => {
    if (state === 'idle') {
      clearChunkRecoveryFlag();
    }
  }, [state]);

  return null;
};

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
    <ChunkRecoveryReset />

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
