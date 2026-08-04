import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { DEFAULT_SORT, SHOP_PARAMS, SORT_CONFIG, VALUE_SEPARATOR } from '@/constants/shop';
import type { Availability, FacetKey, ShopFilters, SortKey } from '@/types/shop';

/** Maps each multi-select facet to its URL parameter. */
const FACET_PARAM: Record<FacetKey, string> = {
  brands: SHOP_PARAMS.brand,
  materials: SHOP_PARAMS.material,
  colors: SHOP_PARAMS.color,
  sizes: SHOP_PARAMS.size,
};

const readList = (params: URLSearchParams, key: string): string[] => {
  const raw = params.get(key);

  return raw === null || raw === ''
    ? []
    : raw
        .split(VALUE_SEPARATOR)
        .map((value) => value.trim())
        .filter((value) => value !== '');
};

const readNumber = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key);

  if (raw === null) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export interface UseShopFilters {
  readonly filters: ShopFilters;
  /** Number of active filters, for the mobile drawer badge. */
  readonly activeCount: number;
  readonly setSearch: (value: string) => void;
  readonly toggleFacet: (facet: FacetKey, value: string) => void;
  readonly setPriceRange: (min: number | null, max: number | null) => void;
  readonly setAvailability: (value: Availability | null) => void;
  readonly setSort: (value: SortKey) => void;
  readonly setPage: (value: number) => void;
  readonly clearFilters: () => void;
}

/**
 * Reads and writes the entire Shop listing state through the URL.
 *
 * Holding this in the query string rather than component state makes every
 * result set linkable and keeps the back button meaningful. Any change other
 * than paging resets to page 1, since page 4 of a different result set is
 * meaningless.
 */
export const useShopFilters = (): UseShopFilters => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { category } = useParams<{ category?: string }>();

  const filters = useMemo<ShopFilters>(() => {
    const sortParam = searchParams.get(SHOP_PARAMS.sort);
    const sort =
      sortParam !== null && Object.hasOwn(SORT_CONFIG, sortParam)
        ? (sortParam as SortKey)
        : DEFAULT_SORT;

    const availability = searchParams.get(SHOP_PARAMS.availability);
    const page = readNumber(searchParams, SHOP_PARAMS.page);

    return {
      search: searchParams.get(SHOP_PARAMS.search) ?? '',
      category: category ?? null,
      brands: readList(searchParams, SHOP_PARAMS.brand),
      materials: readList(searchParams, SHOP_PARAMS.material),
      colors: readList(searchParams, SHOP_PARAMS.color),
      sizes: readList(searchParams, SHOP_PARAMS.size),
      availability: availability === 'in' || availability === 'out' ? availability : null,
      minPrice: readNumber(searchParams, SHOP_PARAMS.minPrice),
      maxPrice: readNumber(searchParams, SHOP_PARAMS.maxPrice),
      sort,
      page: page !== null && page >= 1 ? Math.floor(page) : 1,
    };
  }, [searchParams, category]);

  /**
   * Applies a mutation to the query string.
   *
   * `replace` is used for search so that typing does not fill the history
   * stack with a step per keystroke.
   */
  const update = useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      { resetPage = true, replace = false }: { resetPage?: boolean; replace?: boolean } = {},
    ) => {
      const next = new URLSearchParams(searchParams);

      mutate(next);

      if (resetPage) {
        next.delete(SHOP_PARAMS.page);
      }

      setSearchParams(next, { replace, preventScrollReset: true });
    },
    [searchParams, setSearchParams],
  );

  const setSearch = useCallback(
    (value: string) => {
      update(
        (params) => {
          if (value.trim() === '') {
            params.delete(SHOP_PARAMS.search);
          } else {
            params.set(SHOP_PARAMS.search, value.trim());
          }
        },
        { replace: true },
      );
    },
    [update],
  );

  const toggleFacet = useCallback(
    (facet: FacetKey, value: string) => {
      const param = FACET_PARAM[facet];

      update((params) => {
        const current = readList(params, param);
        const next = current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value];

        if (next.length === 0) {
          params.delete(param);
        } else {
          params.set(param, next.join(VALUE_SEPARATOR));
        }
      });
    },
    [update],
  );

  const setPriceRange = useCallback(
    (min: number | null, max: number | null) => {
      update((params) => {
        for (const [key, value] of [
          [SHOP_PARAMS.minPrice, min],
          [SHOP_PARAMS.maxPrice, max],
        ] as const) {
          if (value === null) {
            params.delete(key);
          } else {
            params.set(key, String(Math.round(value)));
          }
        }
      });
    },
    [update],
  );

  const setAvailability = useCallback(
    (value: Availability | null) => {
      update((params) => {
        if (value === null) {
          params.delete(SHOP_PARAMS.availability);
        } else {
          params.set(SHOP_PARAMS.availability, value);
        }
      });
    },
    [update],
  );

  const setSort = useCallback(
    (value: SortKey) => {
      update((params) => {
        if (value === DEFAULT_SORT) {
          params.delete(SHOP_PARAMS.sort);
        } else {
          params.set(SHOP_PARAMS.sort, value);
        }
      });
    },
    [update],
  );

  const setPage = useCallback(
    (value: number) => {
      update(
        (params) => {
          if (value <= 1) {
            params.delete(SHOP_PARAMS.page);
          } else {
            params.set(SHOP_PARAMS.page, String(value));
          }
        },
        { resetPage: false },
      );
    },
    [update],
  );

  /** Clears filters but keeps the search term and sort order. */
  const clearFilters = useCallback(() => {
    update((params) => {
      for (const key of [
        SHOP_PARAMS.brand,
        SHOP_PARAMS.material,
        SHOP_PARAMS.color,
        SHOP_PARAMS.size,
        SHOP_PARAMS.availability,
        SHOP_PARAMS.minPrice,
        SHOP_PARAMS.maxPrice,
      ]) {
        params.delete(key);
      }
    });
  }, [update]);

  const activeCount =
    filters.brands.length +
    filters.materials.length +
    filters.colors.length +
    filters.sizes.length +
    (filters.availability === null ? 0 : 1) +
    (filters.minPrice === null && filters.maxPrice === null ? 0 : 1);

  return {
    filters,
    activeCount,
    setSearch,
    toggleFacet,
    setPriceRange,
    setAvailability,
    setSort,
    setPage,
    clearFilters,
  };
};
