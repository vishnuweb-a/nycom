/**
 * Loading placeholder matching the ProductCard footprint.
 *
 * Mirrors the card's real dimensions so the grid does not reflow when data
 * arrives. Hidden from assistive technology — the surrounding region announces
 * loading via `aria-busy`.
 */
export const ProductCardSkeleton = () => (
  <div
    aria-hidden="true"
    className="flex h-full flex-col overflow-hidden rounded-product bg-white shadow-card"
  >
    <div className="aspect-4/5 animate-pulse bg-placeholder" />

    <div className="flex flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="h-3 w-1/2 animate-pulse rounded-input bg-placeholder" />
      <div className="h-4 w-full animate-pulse rounded-input bg-placeholder" />
      <div className="h-4 w-4/5 animate-pulse rounded-input bg-placeholder" />
      <div className="h-6 w-2/5 animate-pulse rounded-input bg-placeholder" />
      <div className="h-4 w-1/3 animate-pulse rounded-input bg-placeholder" />
    </div>
  </div>
);
