import { Outlet } from 'react-router';

/**
 * Application shell shared by every route.
 *
 * Header, category navigation, footer and the mobile bottom navigation are
 * added in Phase 2 (Core Layout); this file owns the landmark structure and the
 * skip link so keyboard users can bypass navigation on every page.
 */
export const MainLayout = () => (
  <div className="flex min-h-screen flex-col bg-background">
    <a
      href="#main-content"
      className="sr-only rounded-button bg-primary px-4 py-3 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
    >
      Skip to main content
    </a>

    <main id="main-content" className="flex-1">
      <Outlet />
    </main>
  </div>
);
