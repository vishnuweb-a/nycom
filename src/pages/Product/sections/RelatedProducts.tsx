import { useCallback } from 'react';

import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton/ProductCardSkeleton';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getRelatedProducts, RELATED_LIMIT } from '@/services/productDetail';
import type { Product } from '@/types/product';

export interface RelatedProductsProps {
  product: Product;
}

const SKELETON_KEYS = Array.from(
  { length: RELATED_LIMIT },
  (_, index) => `related-${String(index)}`,
);

const GRID = 'grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6';

/**
 * "You may also like" rail.
 *
 * Failure is silent: related products are a nicety, and an error panel under a
 * product the shopper is actively considering would be noise, not help.
 */
export const RelatedProducts = ({ product }: RelatedProductsProps) => {
  const fetcher = useCallback(
    (signal: AbortSignal) => getRelatedProducts(product, signal),
    [product],
  );

  const { data, status } = useAsyncData(fetcher);

  if (status === 'error' || (status === 'success' && (data === null || data.length === 0))) {
    return null;
  }

  return (
    <section aria-labelledby="related-products">
      <h2 id="related-products" className="mb-6 text-h5 md:text-h3">
        You may also like
      </h2>

      {status === 'loading' ? (
        <div aria-busy="true" aria-label="Loading related products" className={GRID}>
          {SKELETON_KEYS.map((key) => (
            <ProductCardSkeleton key={key} />
          ))}
        </div>
      ) : (
        <ul className={GRID}>
          {(data ?? []).map((related) => (
            <li key={related.id}>
              <ProductCard product={related} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
