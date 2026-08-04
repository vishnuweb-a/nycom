import type { CloudinaryAsset } from '@/types/product';

/**
 * Builds optimised Cloudinary delivery URLs.
 *
 * Stored `secure_url`s point at the original 1080×1440 upload, which is far
 * larger than any slot renders. Rewriting the URL with a transformation makes
 * the CDN serve a right-sized, auto-formatted (AVIF/WebP) derivative, and lets
 * one stored asset serve a card, a hero and a thumbnail without re-uploading.
 */

/** Transformation segment inserted after `/upload/`. */
interface TransformOptions {
  /** Target width in CSS pixels. */
  width: number;
  /** Aspect ratio as `w:h`, e.g. `'4:5'`. Omit to keep the original. */
  aspectRatio?: string;
  /** Crop mode. `fill` keeps the box and crops overflow. */
  crop?: 'fill' | 'fit';
}

const UPLOAD_SEGMENT = '/upload/';

const buildTransform = ({ width, aspectRatio, crop = 'fill' }: TransformOptions): string =>
  [
    'f_auto', // Negotiate AVIF/WebP per browser
    'q_auto', // Perceptual quality target
    'dpr_auto', // Serve 2x on retina
    `w_${String(width)}`,
    aspectRatio === undefined ? null : `ar_${aspectRatio}`,
    `c_${crop}`,
    crop === 'fill' ? 'g_auto' : null, // Content-aware crop keeps the garment centred
  ]
    .filter((part) => part !== null)
    .join(',');

/**
 * Returns a transformed delivery URL.
 *
 * Falls back to the original URL when it is not a recognisable Cloudinary
 * upload path, so a manually entered image still renders.
 */
export const cloudinaryUrlFromSrc = (src: string, options: TransformOptions): string => {
  const index = src.indexOf(UPLOAD_SEGMENT);

  if (index === -1) {
    return src;
  }

  const prefix = src.slice(0, index + UPLOAD_SEGMENT.length);
  const suffix = src.slice(index + UPLOAD_SEGMENT.length);

  return `${prefix}${buildTransform(options)}/${suffix}`;
};

/** Asset-based overload, used everywhere a full `CloudinaryAsset` is on hand. */
export const cloudinaryUrl = (asset: CloudinaryAsset, options: TransformOptions): string =>
  cloudinaryUrlFromSrc(asset.secure_url, options);

/**
 * Builds a `srcset` across the given widths so the browser picks the cheapest
 * source that satisfies the layout.
 */
export const cloudinarySrcSet = (
  asset: CloudinaryAsset,
  widths: readonly number[],
  options: Omit<TransformOptions, 'width'>,
): string =>
  widths
    .map((width) => `${cloudinaryUrl(asset, { ...options, width })} ${String(width)}w`)
    .join(', ');
