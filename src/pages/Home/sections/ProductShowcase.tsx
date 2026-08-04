import { AlertCircle, PackageSearch } from 'lucide-react';
import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Section } from '@/components/common/Section';
import { StatusMessage } from '@/components/common/StatusMessage';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton/ProductCardSkeleton';
import { ROUTES } from '@/constants/routes';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { Product } from '@/types/product';

export interface ProductShowcaseProps {
  title: string;
  description: string;
  /** Must be stable — pass a module-level service function, not an inline arrow. */
  fetcher: (signal: AbortSignal) => Promise<readonly Product[]>;
  /** Eager-loads the first row of images. Set on the topmost rail only. */
  priority?: boolean;
}

const SKELETON_KEYS = ['a', 'b', 'c', 'd'];

/**
 * A titled rail of products — powers both Featured (prd.md §7 Section 4) and
 * Top Selling (Section 5), which differ only in their query and copy.
 *
 * Grid columns follow design.md: 4 on desktop, 3 on tablet, 2 on mobile and 1
 * on small mobile.
 */
export const ProductShowcase = ({
  title,
  description,
  fetcher,
  priority = false,
}: ProductShowcaseProps) => {
  const { data, status, error, retry } = useAsyncData(fetcher);

  return (
    <Section
      title={title}
      description={description}
      action={
        <Link to={ROUTES.SHOP} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          View all
        </Link>
      }
    >
      {status === 'loading' && (
        <div
          aria-busy="true"
          aria-label={`Loading ${title.toLowerCase()}`}
          className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 md:gap-6 lg:grid-cols-4"
        >
          {SKELETON_KEYS.map((key) => (
            <ProductCardSkeleton key={key} />
          ))}
        </div>
      )}

      {status === 'error' && (
        <StatusMessage
          icon={AlertCircle}
          tone="error"
          title="We couldn't load these products"
          description={error ?? 'Something went wrong while loading the catalogue.'}
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
            icon={PackageSearch}
            title="Nothing here yet"
            description="New pieces are on their way. Browse the full collection in the meantime."
            action={
              <Link to={ROUTES.SHOP} className={buttonVariants({ size: 'sm' })}>
                Browse the shop
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {data.map((product, productIndex) => (
              <li key={product.id}>
                <ProductCard product={product} priority={priority && productIndex < 4} />
              </li>
            ))}
          </ul>
        ))}
    </Section>
  );
};
