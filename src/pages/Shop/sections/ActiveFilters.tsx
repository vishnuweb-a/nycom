import { X } from 'lucide-react';

import type { UseShopFilters } from '@/hooks/useShopFilters';
import type { FacetKey } from '@/types/shop';
import { formatPrice } from '@/utils/format';

export interface ActiveFiltersProps {
  controls: UseShopFilters;
}

/**
 * Removable chips for every active filter.
 *
 * Without these the only way to see what is narrowing a result set is to open
 * the sidebar and scan it, which on mobile means opening the drawer.
 */
export const ActiveFilters = ({ controls }: ActiveFiltersProps) => {
  const { filters, activeCount, toggleFacet, setPriceRange, setAvailability, clearFilters } =
    controls;

  if (activeCount === 0) {
    return null;
  }

  interface Chip {
    key: string;
    label: string;
    remove: () => void;
  }

  const selections: { facet: FacetKey; values: readonly string[] }[] = [
    { facet: 'brands', values: filters.brands },
    { facet: 'sizes', values: filters.sizes },
    { facet: 'colors', values: filters.colors },
    { facet: 'materials', values: filters.materials },
  ];

  const facetChips: Chip[] = selections.flatMap(({ facet, values }) =>
    values.map((value) => ({
      key: `${facet}:${value}`,
      label: value.replace(/-/g, ' '),
      remove: () => {
        toggleFacet(facet, value);
      },
    })),
  );

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    facetChips.push({
      key: 'price',
      label: `${filters.minPrice === null ? 'Up to' : formatPrice(filters.minPrice)}${
        filters.minPrice === null ? '' : ' – '
      }${filters.maxPrice === null ? 'and up' : formatPrice(filters.maxPrice)}`,
      remove: () => {
        setPriceRange(null, null);
      },
    });
  }

  if (filters.availability !== null) {
    facetChips.push({
      key: 'availability',
      label: filters.availability === 'in' ? 'In stock' : 'Out of stock',
      remove: () => {
        setAvailability(null);
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="sr-only">Active filters</h2>

      {facetChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-pill bg-primary-light px-3 text-small font-medium text-primary capitalize transition-colors hover:bg-primary hover:text-white"
        >
          {chip.label}
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}

      <button
        type="button"
        onClick={clearFilters}
        className="inline-flex min-h-tap items-center rounded-input px-2 text-small font-semibold text-secondary underline underline-offset-2 hover:text-primary"
      >
        Clear all
      </button>
    </div>
  );
};
