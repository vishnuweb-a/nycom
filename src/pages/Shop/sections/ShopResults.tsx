import { AlertCircle, PackageSearch, SearchX } from 'lucide-react';
import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Pagination } from '@/components/common/Pagination/Pagination';
import { StatusMessage } from '@/components/common/StatusMessage';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton/ProductCardSkeleton';
import { PAGE_SIZE } from '@/constants/shop';
import { ROUTES } from '@/constants/routes';
import type { AsyncStatus } from '@/hooks/useAsyncData';
import type { ShopResult } from '@/types/shop';

export interface ShopResultsProps {
  result: ShopResult | null;
  status: AsyncStatus;
  error: string | null;
  onRetry: () => void;
  page: number;
  onPageChange: (page: number) => void;
  /** Drives the empty-state copy: a fruitless search reads differently to an empty shelf. */
  hasQuery: boolean;
  onClearFilters: () => void;
}

const SKELETON_KEYS = Array.from({ length: PAGE_SIZE }, (_, index) => `skeleton-${String(index)}`);

const GRID = 'grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4';

/**
 * The product grid with its loading, empty and error states.
 *
 * Columns follow design.md: 4 on desktop, 3 on tablet, 2 on mobile, 1 on small
 * mobile.
 */
export const ShopResults = ({
  result,
  status,
  error,
  onRetry,
  page,
  onPageChange,
  hasQuery,
  onClearFilters,
}: ShopResultsProps) => {
  if (status === 'loading') {
    return (
      <div aria-busy="true" aria-label="Loading products" className={GRID}>
        {SKELETON_KEYS.map((key) => (
          <ProductCardSkeleton key={key} />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <StatusMessage
        icon={AlertCircle}
        tone="error"
        title="We couldn't load these products"
        description={error ?? 'Something went wrong while loading the catalogue.'}
        action={
          <button type="button" onClick={onRetry} className={buttonVariants({ size: 'sm' })}>
            Try again
          </button>
        }
      />
    );
  }

  const products = result?.products ?? [];
  const total = result?.total ?? 0;

  if (products.length === 0) {
    return hasQuery ? (
      <StatusMessage
        icon={SearchX}
        title="No matches found"
        description="We couldn't find anything for that combination. Try fewer filters or a different search term."
        action={
          <button
            type="button"
            onClick={onClearFilters}
            className={buttonVariants({ size: 'sm', variant: 'secondary' })}
          >
            Clear filters
          </button>
        }
      />
    ) : (
      <StatusMessage
        icon={PackageSearch}
        title="This shelf is still being stocked"
        description="There are no products in this category yet. New pieces land every week."
        action={
          <Link to={ROUTES.SHOP} className={buttonVariants({ size: 'sm' })}>
            Browse everything
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className={GRID}>
        {products.map((product, index) => (
          <li key={product.id}>
            <ProductCard product={product} priority={page === 1 && index < 4} />
          </li>
        ))}
      </ul>

      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} onChange={onPageChange} />
    </div>
  );
};
