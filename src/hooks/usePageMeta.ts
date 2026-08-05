import { useEffect } from 'react';

export interface PageMeta {
  /** Full document title, including the brand suffix. */
  title: string;
  /** Meta description, ~155 characters. */
  description: string;
  /** Absolute canonical URL. Omit to leave the document canonical untouched. */
  canonical?: string;
}

/**
 * Applies per-route head metadata on a client-rendered page.
 *
 * The app ships as an SPA with a single `index.html`, so a route that needs its
 * own title, description or canonical has to write them at runtime. Every value
 * is captured before it is replaced and restored on unmount, so navigating away
 * never leaves a stale title or canonical pointing at the previous page.
 *
 * Mirrors the inline effect the Product page uses for its per-product copy;
 * routes with static metadata use this hook instead of repeating it.
 */
export const usePageMeta = ({ title, description, canonical }: PageMeta): void => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute('content') ?? null;
    descriptionTag?.setAttribute('content', description);

    const canonicalTag = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonicalTag?.getAttribute('href') ?? null;

    if (canonical !== undefined) {
      canonicalTag?.setAttribute('href', canonical);
    }

    return () => {
      document.title = previousTitle;

      if (previousDescription !== null) {
        descriptionTag?.setAttribute('content', previousDescription);
      }

      if (previousCanonical !== null) {
        canonicalTag?.setAttribute('href', previousCanonical);
      }
    };
  }, [title, description, canonical]);
};
