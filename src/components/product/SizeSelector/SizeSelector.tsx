import type { ProductVariant } from '@/types/product';
import { cn } from '@/utils/cn';

export interface SizeSelectorProps {
  variants: readonly ProductVariant[];
  selectedSize: string | null;
  onSelect: (size: string) => void;
  /** Shown when the shopper tries to buy without choosing. */
  error?: string | undefined;
}

const isBuyable = (variant: ProductVariant): boolean =>
  variant.stock === 'in_stock' && variant.quantity > 0;

/**
 * Size picker.
 *
 * Built from real radio inputs so arrow keys move between options and the
 * selection is announced natively. Sold-out sizes stay visible but disabled —
 * removing them hides useful information about what the product comes in, and
 * a disabled input is skipped by keyboard navigation anyway.
 */
export const SizeSelector = ({ variants, selectedSize, onSelect, error }: SizeSelectorProps) => {
  const errorId = 'size-selector-error';

  return (
    <fieldset aria-describedby={error === undefined ? undefined : errorId}>
      <legend className="mb-3 text-base font-semibold text-heading">
        Select size
        {error !== undefined && (
          <span className="ml-2 text-small font-medium text-danger">{error}</span>
        )}
      </legend>

      <div className="flex flex-wrap gap-3">
        {variants.map((variant) => {
          const available = isBuyable(variant);
          const isSelected = variant.size === selectedSize;

          return (
            <label
              key={variant.size}
              className={cn(
                'relative flex min-h-tap min-w-tap items-center justify-center rounded-input border px-4 text-base font-medium transition-colors',
                available
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed border-border text-light line-through',
                available && isSelected
                  ? 'border-primary bg-primary-light text-primary'
                  : available && 'border-border text-text hover:border-primary',
              )}
            >
              <input
                type="radio"
                name="size"
                value={variant.size}
                checked={isSelected}
                disabled={!available}
                onChange={() => {
                  onSelect(variant.size);
                }}
                className="sr-only"
              />

              {variant.size}

              {!available && <span className="sr-only"> — out of stock</span>}
            </label>
          );
        })}
      </div>

      {error !== undefined && (
        <p id={errorId} role="alert" className="sr-only">
          {error}
        </p>
      )}
    </fieldset>
  );
};
