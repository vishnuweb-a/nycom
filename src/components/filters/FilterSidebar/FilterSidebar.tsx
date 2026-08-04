import { NavLink } from 'react-router';

import { CheckboxFacet } from '@/components/filters/CheckboxFacet/CheckboxFacet';
import { FilterGroup } from '@/components/filters/FilterGroup/FilterGroup';
import { PillFacet } from '@/components/filters/PillFacet/PillFacet';
import { PriceFacet } from '@/components/filters/PriceFacet/PriceFacet';
import { CATEGORIES } from '@/constants/categories';
import { ROUTES, shopCategoryPath } from '@/constants/routes';
import type { UseShopFilters } from '@/hooks/useShopFilters';
import type { ShopFacets } from '@/types/shop';
import { cn } from '@/utils/cn';

export interface FilterSidebarProps {
  facets: ShopFacets;
  controls: UseShopFilters;
}

/**
 * The full filter set, shared by the desktop sidebar and the mobile drawer.
 *
 * A facet with fewer than two options is omitted entirely: offering a single
 * checkbox that cannot change the result set is noise. Availability appears
 * only when the selection actually contains both in- and out-of-stock items.
 */
export const FilterSidebar = ({ facets, controls }: FilterSidebarProps) => {
  const { filters, toggleFacet, setPriceRange, setAvailability } = controls;

  const showBrands = facets.brands.length > 1;
  const showMaterials = facets.materials.length > 1;
  const showColors = facets.colors.length > 1;
  const showSizes = facets.sizes.length > 1;
  const showPrice = facets.priceCeiling > facets.priceFloor;
  const showAvailability = facets.hasInStock && facets.hasOutOfStock;

  return (
    <div className="flex flex-col">
      <FilterGroup title="Category" selectedCount={filters.category === null ? 0 : 1}>
        <ul className="flex flex-col gap-1">
          <li>
            <NavLink
              to={ROUTES.SHOP}
              end
              className={({ isActive }) =>
                cn(
                  'flex min-h-tap items-center rounded-input px-1 text-base transition-colors hover:text-primary',
                  isActive ? 'font-semibold text-primary' : 'text-body',
                )
              }
            >
              All products
            </NavLink>
          </li>

          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <NavLink
                to={shopCategoryPath(category.slug)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-tap items-center rounded-input px-1 text-base transition-colors hover:text-primary',
                    isActive ? 'font-semibold text-primary' : 'text-body',
                  )
                }
              >
                {category.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </FilterGroup>

      {showPrice && (
        <FilterGroup
          title="Price"
          selectedCount={filters.minPrice === null && filters.maxPrice === null ? 0 : 1}
        >
          <PriceFacet
            floor={facets.priceFloor}
            ceiling={facets.priceCeiling}
            min={filters.minPrice}
            max={filters.maxPrice}
            onChange={setPriceRange}
          />
        </FilterGroup>
      )}

      {showBrands && (
        <FilterGroup title="Brand" selectedCount={filters.brands.length}>
          <CheckboxFacet
            legend="Filter by brand"
            options={facets.brands}
            selected={filters.brands}
            onToggle={(value) => {
              toggleFacet('brands', value);
            }}
          />
        </FilterGroup>
      )}

      {showSizes && (
        <FilterGroup title="Size" selectedCount={filters.sizes.length}>
          <PillFacet
            legend="Filter by size"
            options={facets.sizes}
            selected={filters.sizes}
            onToggle={(value) => {
              toggleFacet('sizes', value);
            }}
          />
        </FilterGroup>
      )}

      {showColors && (
        <FilterGroup title="Colour" selectedCount={filters.colors.length}>
          <PillFacet
            swatches
            legend="Filter by colour"
            options={facets.colors}
            selected={filters.colors}
            onToggle={(value) => {
              toggleFacet('colors', value);
            }}
          />
        </FilterGroup>
      )}

      {showMaterials && (
        <FilterGroup title="Material" selectedCount={filters.materials.length}>
          <CheckboxFacet
            legend="Filter by material"
            options={facets.materials}
            selected={filters.materials}
            onToggle={(value) => {
              toggleFacet('materials', value);
            }}
          />
        </FilterGroup>
      )}

      {showAvailability && (
        <FilterGroup title="Availability" selectedCount={filters.availability === null ? 0 : 1}>
          <fieldset>
            <legend className="sr-only">Filter by availability</legend>

            <ul className="flex flex-col gap-1">
              {(
                [
                  { value: 'in', label: 'In stock' },
                  { value: 'out', label: 'Out of stock' },
                ] as const
              ).map((option) => (
                <li key={option.value}>
                  <label className="flex min-h-tap cursor-pointer items-center gap-3 rounded-input px-1 text-base text-body hover:text-primary">
                    <input
                      type="radio"
                      name="availability"
                      checked={filters.availability === option.value}
                      onChange={() => {
                        setAvailability(option.value);
                      }}
                      className="size-4 shrink-0 accent-primary"
                    />
                    {option.label}
                  </label>
                </li>
              ))}

              <li>
                <label className="flex min-h-tap cursor-pointer items-center gap-3 rounded-input px-1 text-base text-body hover:text-primary">
                  <input
                    type="radio"
                    name="availability"
                    checked={filters.availability === null}
                    onChange={() => {
                      setAvailability(null);
                    }}
                    className="size-4 shrink-0 accent-primary"
                  />
                  Any
                </label>
              </li>
            </ul>
          </fieldset>
        </FilterGroup>
      )}
    </div>
  );
};
