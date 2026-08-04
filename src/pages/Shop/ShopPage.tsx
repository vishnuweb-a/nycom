import { SlidersHorizontal } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button, buttonVariants } from '@/components/buttons/Button';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Container } from '@/components/common/Container';
import { Drawer } from '@/components/common/Drawer/Drawer';
import { FilterSidebar } from '@/components/filters/FilterSidebar/FilterSidebar';
import { CATEGORIES } from '@/constants/categories';
import { shopCategoryPath } from '@/constants/routes';
import { DEFAULT_SORT, SORT_CONFIG, SORT_ORDER } from '@/constants/shop';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useShopFilters } from '@/hooks/useShopFilters';
import { ActiveFilters } from '@/pages/Shop/sections/ActiveFilters';
import { ShopResults } from '@/pages/Shop/sections/ShopResults';
import { ShopSearch } from '@/pages/Shop/sections/ShopSearch';
import { getShopFacets, getShopProducts } from '@/services/shop';
import type { ShopFilters, SortKey } from '@/types/shop';
import { formatCount } from '@/utils/format';

/**
 * Product listing — prd.md §8.
 *
 * Every piece of listing state lives in the URL (see `useShopFilters`), so the
 * page is a pure function of the address bar: results are shareable, the back
 * button works, and a reload restores exactly what the shopper was looking at.
 *
 * Two queries run per view — one page of products with an exact match count,
 * and one pass to derive available filter values. Both are cancelled on change.
 */
const ShopPage = () => {
  const controls = useShopFilters();
  const { filters, activeCount, setSort, setPage, clearFilters, setSearch } = controls;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const productsFetcher = useCallback(
    (signal: AbortSignal) => getShopProducts(filters, signal),
    [filters],
  );

  /**
   * Facets deliberately ignore page, sort and the multi-select selections, so
   * they are only refetched when something that changes the option set changes.
   * Built from primitives rather than spreading `filters` to keep that true.
   */
  const facetFilters = useMemo<ShopFilters>(
    () => ({
      search: filters.search,
      category: filters.category,
      brands: [],
      materials: [],
      colors: [],
      sizes: [],
      availability: filters.availability,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      sort: DEFAULT_SORT,
      page: 1,
    }),
    [filters.search, filters.category, filters.availability, filters.minPrice, filters.maxPrice],
  );

  const facetsFetcher = useCallback(
    (signal: AbortSignal) => getShopFacets(facetFilters, signal),
    [facetFilters],
  );

  const products = useAsyncData(productsFetcher);
  const facets = useAsyncData(facetsFetcher);

  const category = CATEGORIES.find((entry) => entry.slug === filters.category);
  const heading = category === undefined ? 'All products' : category.name;
  const total = products.data?.total ?? 0;

  const breadcrumb = useMemo(
    () =>
      category === undefined
        ? [{ label: 'Shop', path: '/shop' }]
        : [
            { label: 'Shop', path: '/shop' },
            { label: category.name, path: shopCategoryPath(category.slug) },
          ],
    [category],
  );

  return (
    <Container className="flex flex-col gap-6 py-6 md:gap-8 md:py-10">
      <Breadcrumb items={breadcrumb} />

      <header className="flex flex-col gap-3">
        <h1 className="text-h3 md:text-h1">{heading}</h1>

        <p className="text-base text-secondary" aria-live="polite">
          {products.status === 'loading'
            ? 'Loading products…'
            : products.status === 'error'
              ? 'Products unavailable'
              : `${formatCount(total)} ${total === 1 ? 'product' : 'products'}`}
          {filters.search !== '' && products.status === 'success' && (
            <>
              {' for '}
              <span className="font-semibold text-text">“{filters.search}”</span>
            </>
          )}
        </p>
      </header>

      <ShopSearch value={filters.search} onChange={setSearch} />

      {/* Toolbar: filter trigger on mobile, sort everywhere. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDrawerOpen(true);
          }}
          className="md:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-pill bg-primary px-2 py-0.5 text-caption text-white">
              {activeCount}
            </span>
          )}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="shop-sort" className="text-small whitespace-nowrap text-secondary">
            Sort by
          </label>

          <select
            id="shop-sort"
            value={filters.sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
            }}
            className="h-tap rounded-input border border-border bg-background px-3 text-base text-text focus:border-primary"
          >
            {SORT_ORDER.map((key) => (
              <option key={key} value={key}>
                {SORT_CONFIG[key].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ActiveFilters controls={controls} />

      <div className="flex gap-8">
        {/* Desktop sidebar — sticky below the 72px header plus the 52px nav. */}
        <aside className="hidden w-sidebar shrink-0 md:block">
          <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
            <h2 className="sr-only">Filters</h2>

            {facets.status === 'success' && facets.data !== null ? (
              <FilterSidebar facets={facets.data} controls={controls} />
            ) : facets.status === 'error' ? (
              <p className="text-small text-danger">Filters unavailable.</p>
            ) : (
              <div aria-busy="true" aria-label="Loading filters" className="flex flex-col gap-4">
                {['a', 'b', 'c', 'd'].map((key) => (
                  <div key={key} className="h-10 animate-pulse rounded-input bg-placeholder" />
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <ShopResults
            result={products.data}
            status={products.status}
            error={products.error}
            onRetry={products.retry}
            page={filters.page}
            onPageChange={setPage}
            hasQuery={filters.search !== '' || activeCount > 0}
            onClearFilters={clearFilters}
          />
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
        title="Filters"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className={buttonVariants({ variant: 'secondary', fullWidth: true })}
            >
              Clear all
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
              }}
              className={buttonVariants({ fullWidth: true })}
            >
              Show {formatCount(total)} results
            </button>
          </div>
        }
      >
        {facets.status === 'success' && facets.data !== null ? (
          <FilterSidebar facets={facets.data} controls={controls} />
        ) : (
          <p className="py-8 text-center text-base text-secondary">Loading filters…</p>
        )}
      </Drawer>
    </Container>
  );
};

export default ShopPage;
