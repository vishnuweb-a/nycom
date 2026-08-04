import type { FacetOption } from '@/types/shop';

export interface CheckboxFacetProps {
  legend: string;
  options: readonly FacetOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}

/**
 * Checkbox list for the Brand and Material facets.
 *
 * Grouped in a `<fieldset>` with a visually hidden `<legend>` so screen reader
 * users hear what the checkboxes belong to; the visible heading comes from the
 * surrounding FilterGroup.
 */
export const CheckboxFacet = ({ legend, options, selected, onToggle }: CheckboxFacetProps) => (
  <fieldset className="max-h-56 overflow-y-auto">
    <legend className="sr-only">{legend}</legend>

    <ul className="flex flex-col gap-1">
      {options.map((option) => (
        <li key={option.value}>
          <label className="flex min-h-tap cursor-pointer items-center gap-3 rounded-input px-1 text-base text-body hover:text-primary">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => {
                onToggle(option.value);
              }}
              className="size-4 shrink-0 accent-primary"
            />
            <span className="truncate">{option.label}</span>
          </label>
        </li>
      ))}
    </ul>
  </fieldset>
);
