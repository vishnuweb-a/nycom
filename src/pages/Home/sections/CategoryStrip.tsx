import { AlertCircle, LayoutGrid } from 'lucide-react';

import { buttonVariants } from '@/components/buttons/Button';
import { Section } from '@/components/common/Section';
import { StatusMessage } from '@/components/common/StatusMessage';
import { CategoryCard } from '@/components/cards/CategoryCard/CategoryCard';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getCategories } from '@/services/categories';

/** Loading placeholder matching the circular card footprint. */
const CategorySkeleton = () => (
  <div aria-hidden="true" className="flex flex-col items-center gap-3 p-2">
    <div className="size-category animate-pulse rounded-pill bg-placeholder md:size-28" />
    <div className="h-4 w-16 animate-pulse rounded-input bg-placeholder" />
  </div>
);

/**
 * Shop by category — prd.md §7 Section 3.
 *
 * Scrolls horizontally on narrow screens per design.md → Category Chips, and
 * centres on wider screens where all categories fit.
 */
export const CategoryStrip = () => {
  const { data, status, error, retry } = useAsyncData(getCategories);

  return (
    <Section title="Shop by category" description="Find your next favourite by who it's for.">
      {status === 'loading' && (
        <div aria-busy="true" aria-label="Loading categories" className="flex justify-center gap-6">
          {[0, 1, 2].map((key) => (
            <CategorySkeleton key={key} />
          ))}
        </div>
      )}

      {status === 'error' && (
        <StatusMessage
          icon={AlertCircle}
          tone="error"
          title="Categories unavailable"
          description={error ?? 'We could not load the categories.'}
          action={
            <button type="button" onClick={retry} className={buttonVariants({ size: 'sm' })}>
              Try again
            </button>
          }
        />
      )}

      {status === 'success' &&
        (data === null || data.length === 0 ? (
          <StatusMessage
            icon={LayoutGrid}
            title="No categories yet"
            description="Categories will appear here as soon as the catalogue is published."
          />
        ) : (
          <ul className="flex [scrollbar-width:none] justify-start gap-4 overflow-x-auto pb-2 md:justify-center md:gap-10 [&::-webkit-scrollbar]:hidden">
            {data.map((category) => (
              <li key={category.id} className="shrink-0">
                <CategoryCard category={category} />
              </li>
            ))}
          </ul>
        ))}
    </Section>
  );
};
