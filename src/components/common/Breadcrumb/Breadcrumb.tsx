import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router';

import { ROUTES } from '@/constants/routes';
import type { NavLink } from '@/types/navigation';
import { cn } from '@/utils/cn';

export interface BreadcrumbProps {
  /**
   * Trail excluding Home, which is always prepended. The final entry is
   * rendered as the current page and is not linked.
   */
  items: readonly NavLink[];
  className?: string;
}

/**
 * Hierarchical trail for Shop, Category and Product pages.
 *
 * The last crumb carries `aria-current="page"` and is plain text, since linking
 * to the page you are already on is a known screen reader annoyance.
 */
export const Breadcrumb = ({ items, className }: BreadcrumbProps) => {
  const trail: readonly NavLink[] = [{ label: 'Home', path: ROUTES.HOME }, ...items];

  return (
    <nav aria-label="Breadcrumb" className={cn('w-full', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-small text-secondary">
        {trail.map((crumb, index) => {
          const isCurrent = index === trail.length - 1;

          return (
            <Fragment key={crumb.path}>
              <li>
                {isCurrent ? (
                  <span aria-current="page" className="font-medium text-text">
                    {crumb.label}
                  </span>
                ) : (
                  <Link to={crumb.path} className="rounded-input hover:text-primary">
                    {crumb.label}
                  </Link>
                )}
              </li>

              {!isCurrent && (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight className="size-4 text-muted" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
