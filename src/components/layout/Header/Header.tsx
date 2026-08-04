import { NavLink } from 'react-router';

import { Container } from '@/components/common/Container';
import { Logo } from '@/components/common/Logo';
import { SearchBar } from '@/components/common/SearchBar';
import { CartLink } from '@/components/layout/Header/CartLink';
import { PRIMARY_NAV } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * Sticky application header — design.md → Header.
 *
 * Layout by breakpoint:
 * - Small Mobile / Mobile: logo and cart on one row, full-width search beneath.
 * - Tablet and up: a single 72px row with the search bar centred.
 * - Laptop and up: primary navigation links appear beside the logo.
 *
 * Wishlist and Account actions from design.md are intentionally absent: neither
 * feature nor route exists yet, and linking to a 404 is worse than omitting the
 * control. They are added with their features.
 */
export const Header = () => (
  <header className="sticky top-0 z-40 border-b border-border bg-background">
    <Container>
      <div className="flex flex-col gap-3 py-3 md:h-header md:flex-row md:items-center md:gap-6 md:py-0">
        <div className="flex items-center justify-between gap-4 md:justify-start">
          <Logo />
          <CartLink className="inline-flex md:hidden" />
        </div>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-6">
            {PRIMARY_NAV.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === ROUTES.HOME}
                  className={({ isActive }) =>
                    cn(
                      'rounded-input text-base font-medium whitespace-nowrap transition-colors hover:text-primary',
                      isActive ? 'text-primary' : 'text-body',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-1 justify-center">
          <SearchBar />
        </div>

        <CartLink className="hidden md:inline-flex" />
      </div>
    </Container>
  </header>
);
