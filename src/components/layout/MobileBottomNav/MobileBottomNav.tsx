import { NavLink } from 'react-router';

import { BOTTOM_NAV_LINKS } from '@/constants/navigation';
import { cn } from '@/utils/cn';

/**
 * Sticky mobile bottom navigation — design.md → Mobile Behavior.
 *
 * Hidden from tablet up, where the header navigation takes over. Wishlist and
 * Account from the design are omitted until those features exist; the remaining
 * four destinations all resolve.
 *
 * The layout adds `env(safe-area-inset-bottom)` padding so the bar clears the
 * home indicator on notched devices.
 */
export const MobileBottomNav = () => (
  <nav
    aria-label="Mobile navigation"
    className="sticky bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
  >
    <ul className="flex items-stretch justify-around">
      {BOTTOM_NAV_LINKS.map((item) => {
        const Icon = item.icon;

        return (
          <li key={item.path} className="flex flex-1">
            <NavLink
              to={item.path}
              end={item.exact ?? false}
              className={({ isActive }) =>
                cn(
                  'flex min-h-tap flex-1 flex-col items-center justify-center gap-1 py-2 text-caption font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-secondary',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-5" aria-hidden="true" strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  </nav>
);
