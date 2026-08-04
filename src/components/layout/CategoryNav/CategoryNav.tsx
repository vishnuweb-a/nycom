import { NavLink } from 'react-router';

import { Container } from '@/components/common/Container';
import { CATEGORY_NAV_LINKS } from '@/constants/navigation';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * Secondary category bar — design.md → Navigation.
 *
 * 52px tall, scrolls horizontally on narrow screens, and marks the active
 * category with the purple underline from the design system. It sits below the
 * header rather than inside it so the header height stays at the specified
 * 72px on tablet and above.
 */
export const CategoryNav = () => (
  <div className="border-b border-border bg-background">
    <Container>
      <nav aria-label="Shop categories">
        <ul className="flex h-nav [scrollbar-width:none] items-stretch gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {CATEGORY_NAV_LINKS.map((item) => (
            <li key={item.path} className="flex shrink-0 items-stretch">
              <NavLink
                to={item.path}
                end={item.path === ROUTES.SHOP}
                className={({ isActive }) =>
                  cn(
                    'flex items-center border-b-2 text-base font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-body hover:text-primary',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </Container>
  </div>
);
