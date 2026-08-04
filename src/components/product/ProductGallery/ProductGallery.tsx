import { useState } from 'react';

import type { CloudinaryAsset } from '@/types/product';
import { cloudinarySrcSet, cloudinaryUrl } from '@/utils/cloudinary';
import { cn } from '@/utils/cn';

export interface ProductGalleryProps {
  images: readonly CloudinaryAsset[];
  /** Ribbon text overlaid on the hero image, e.g. "Bestseller". */
  ribbon?: string | null;
}

const HERO_WIDTHS = [480, 768, 1024, 1280];
const HERO_ASPECT = '4:5';

/**
 * Product image gallery.
 *
 * The hero is a single `<img>` whose source is derived from the active asset,
 * which is the seam a future zoom would attach to: magnification only needs a
 * higher-resolution Cloudinary derivative of the same `activeImage`, with no
 * change to how selection or state works here.
 *
 * Thumbnails are a radio group rather than buttons, so arrow keys move between
 * views natively and the current selection is announced.
 */
export const ProductGallery = ({ images, ribbon }: ProductGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0] ?? null;

  if (activeImage === null) {
    return (
      <div className="flex aspect-4/5 items-center justify-center rounded-card bg-placeholder text-base text-muted">
        No image available
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      {images.length > 1 && (
        <fieldset className="shrink-0">
          <legend className="sr-only">Choose an image</legend>

          <div className="flex gap-3 overflow-x-auto md:flex-col md:overflow-visible">
            {images.map((image, index) => (
              <label
                key={image.public_id}
                className={cn(
                  'block size-20 shrink-0 cursor-pointer overflow-hidden rounded-image border-2 transition-colors',
                  index === activeIndex
                    ? 'border-primary'
                    : 'border-border hover:border-border-hover',
                )}
              >
                <input
                  type="radio"
                  name="product-image"
                  checked={index === activeIndex}
                  onChange={() => {
                    setActiveIndex(index);
                  }}
                  className="sr-only"
                />

                <img
                  src={cloudinaryUrl(image, { width: 160, aspectRatio: HERO_ASPECT })}
                  alt={`View ${String(index + 1)} of ${String(images.length)}`}
                  width={80}
                  height={100}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="relative flex-1 overflow-hidden rounded-card bg-placeholder">
        <img
          // Keying on the asset makes React swap the element rather than mutate
          // its src, so the fade replays on every change.
          key={activeImage.public_id}
          src={cloudinaryUrl(activeImage, { width: 768, aspectRatio: HERO_ASPECT })}
          srcSet={cloudinarySrcSet(activeImage, HERO_WIDTHS, { aspectRatio: HERO_ASPECT })}
          sizes="(min-width: 1024px) 45vw, (min-width: 768px) 50vw, 100vw"
          alt={activeImage.alt}
          width={768}
          height={960}
          fetchPriority="high"
          decoding="async"
          className="aspect-4/5 w-full animate-fade-in object-cover"
        />

        {ribbon !== null && ribbon !== undefined && (
          <span className="absolute top-4 left-4 rounded-badge bg-primary px-3 py-1 text-small font-semibold text-white">
            {ribbon}
          </span>
        )}
      </div>
    </div>
  );
};
