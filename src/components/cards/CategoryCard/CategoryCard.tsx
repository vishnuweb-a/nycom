import { Link } from 'react-router';

import { shopCategoryPath } from '@/constants/routes';
import type { Category } from '@/types/category';
import { cloudinaryUrl } from '@/utils/cloudinary';

export interface CategoryCardProps {
  category: Category;
}

/**
 * Circular category entry point — design.md → Category Chips.
 *
 * Categories awaiting photography fall back to a monogram plate rather than a
 * stock placeholder image, so an unstocked category reads as deliberate instead
 * of broken.
 */
export const CategoryCard = ({ category }: CategoryCardProps) => (
  <Link
    to={shopCategoryPath(category.slug)}
    className="group flex flex-col items-center gap-3 rounded-card p-2 text-center"
  >
    <span className="block overflow-hidden rounded-pill ring-2 ring-transparent transition-all group-hover:-translate-y-1 group-hover:ring-primary">
      {category.cover_image === null ? (
        <span className="flex size-category items-center justify-center bg-primary-light text-h3 font-bold text-primary md:size-28">
          {category.name.charAt(0)}
        </span>
      ) : (
        <img
          src={cloudinaryUrl(category.cover_image, { width: 224, aspectRatio: '1:1' })}
          alt={category.cover_image.alt}
          width={112}
          height={112}
          loading="lazy"
          decoding="async"
          className="size-category object-cover md:size-28"
        />
      )}
    </span>

    <span className="text-base font-medium text-text transition-colors group-hover:text-primary">
      {category.name}
    </span>
  </Link>
);
