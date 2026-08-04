import { Star } from 'lucide-react';
import { Link } from 'react-router';

import { productPath } from '@/constants/routes';
import {
  availableSizes,
  discountPercent,
  effectivePrice,
  isInStock,
  type Product,
} from '@/types/product';
import { cloudinarySrcSet, cloudinaryUrl } from '@/utils/cloudinary';
import { formatCount, formatPrice, formatRating } from '@/utils/format';

export interface ProductCardProps {
  product: Product;
  /**
   * Set on cards above the fold so the browser fetches them immediately instead
   * of waiting for layout. Leave false for everything below the first screen.
   */
  priority?: boolean;
}

/** Widths the card renders at across the responsive grid. */
const CARD_WIDTHS = [200, 280, 360, 480];

/**
 * Catalogue product card.
 *
 * The whole card is a single link to the product page, so there is one tab stop
 * and one large touch target rather than a cluster of competing controls. The
 * Add to Cart action is introduced with the Cart feature, which owns the state
 * it would mutate.
 */
export const ProductCard = ({ product, priority = false }: ProductCardProps) => {
  const image = product.thumbnail ?? product.images[0] ?? null;
  const discount = discountPercent(product);
  const sizes = availableSizes(product);
  const inStock = isInStock(product);

  return (
    <article className="group relative h-full">
      <Link
        to={productPath(product.slug)}
        className="flex h-full flex-col overflow-hidden rounded-product bg-white shadow-card transition-shadow hover:shadow-card-hover"
      >
        <div className="relative aspect-4/5 overflow-hidden bg-placeholder">
          {image === null ? (
            <div className="flex h-full items-center justify-center text-small text-muted">
              Image coming soon
            </div>
          ) : (
            <img
              src={cloudinaryUrl(image, { width: 360, aspectRatio: '4:5' })}
              srcSet={cloudinarySrcSet(image, CARD_WIDTHS, { aspectRatio: '4:5' })}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              alt={image.alt}
              width={360}
              height={450}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              className="size-full object-cover transition-transform duration-250 group-hover:scale-105"
            />
          )}

          {product.ribbon !== null && (
            <span className="absolute top-3 left-3 rounded-badge bg-primary px-3 py-1 text-caption font-semibold text-white">
              {product.ribbon}
            </span>
          )}

          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <span className="rounded-badge bg-heading px-4 py-2 text-small font-semibold text-white">
                Out of stock
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
          {product.subtitle !== null && (
            <p className="truncate text-caption text-muted">{product.subtitle}</p>
          )}

          <h3 className="line-clamp-2-fixed text-base font-medium text-text">{product.title}</h3>

          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-h4 font-bold text-heading md:text-price">
              {formatPrice(effectivePrice(product))}
            </span>

            {discount !== null && (
              <>
                <span className="text-small text-muted line-through">
                  {formatPrice(product.price)}
                </span>
                <span className="text-small font-semibold text-success">{discount}% off</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-badge bg-success px-2 py-0.5 text-caption font-semibold text-white">
              <Star className="size-3 fill-current" aria-hidden="true" />
              {formatRating(product.rating)}
            </span>

            <span className="text-caption text-muted">
              {formatCount(product.review_count)} reviews
            </span>
          </div>

          {sizes.length > 0 && (
            <p className="mt-auto truncate text-caption text-secondary">
              <span className="sr-only">Available sizes: </span>
              {sizes.join(' · ')}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
};
