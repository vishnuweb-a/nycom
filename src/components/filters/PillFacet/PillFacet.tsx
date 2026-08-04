import type { FacetOption } from '@/types/shop';
import { cn } from '@/utils/cn';

export interface PillFacetProps {
  legend: string;
  options: readonly FacetOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** Renders a colour dot before the label, for the Colour facet. */
  swatches?: boolean;
}

/**
 * Maps a colour name to a CSS colour for the swatch dot.
 *
 * These are literal garment colours describing real dye, not design tokens, so
 * they are intentionally not part of the theme palette — a "rust" saree is rust
 * regardless of branding. Unknown names fall back to a neutral chip.
 */
const SWATCH: Record<string, string> = {
  black: '#111827',
  white: '#FFFFFF',
  'off-white': '#F5F2E9',
  cream: '#F5EBDC',
  beige: '#E8D9C0',
  grey: '#9CA3AF',
  blue: '#2563EB',
  'navy-blue': '#1E3A5F',
  turquoise: '#40C7C7',
  green: '#16A34A',
  olive: '#6B7A3A',
  red: '#DC2626',
  maroon: '#7B1E3A',
  rust: '#B7410E',
  orange: '#EA7317',
  yellow: '#EAB308',
  gold: '#C9A227',
  pink: '#EC4899',
  purple: '#7C3AED',
  brown: '#7C4A28',
  khaki: '#B5A16B',
};

/**
 * Pill selector for the Size and Colour facets.
 *
 * Uses real checkboxes behind the pills so keyboard and screen reader users get
 * native multi-select semantics rather than a set of buttons that merely look
 * selected.
 */
export const PillFacet = ({
  legend,
  options,
  selected,
  onToggle,
  swatches = false,
}: PillFacetProps) => (
  <fieldset>
    <legend className="sr-only">{legend}</legend>

    <ul className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        const swatch = SWATCH[option.value];

        return (
          <li key={option.value}>
            <label
              className={cn(
                'flex min-h-tap cursor-pointer items-center gap-2 rounded-pill border px-3 text-small font-medium transition-colors',
                isSelected
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border text-body hover:border-border-hover',
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  onToggle(option.value);
                }}
                className="sr-only"
              />

              {swatches && (
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 rounded-pill border border-border"
                  style={{ backgroundColor: swatch ?? 'transparent' }}
                />
              )}

              <span className="capitalize">{option.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  </fieldset>
);
