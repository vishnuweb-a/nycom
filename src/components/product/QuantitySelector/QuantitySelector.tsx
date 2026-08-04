import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';

export interface QuantitySelectorProps {
  value: number;
  /** Units available. The control never allows a higher value. */
  max: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
}

/**
 * Stepper for line quantity.
 *
 * The live value is a `<output>` rather than a text input: free text would
 * allow "0", "-2" or "abc" and require validation to undo. The buttons carry
 * the whole interaction and disable at the boundaries, so an invalid quantity
 * is unreachable by construction.
 */
export const QuantitySelector = ({
  value,
  max,
  onChange,
  disabled = false,
}: QuantitySelectorProps) => {
  const labelId = useId();
  const atMin = value <= 1;
  const atMax = value >= max;

  const button =
    'inline-flex size-tap items-center justify-center rounded-input text-body transition-colors hover:bg-primary-light hover:text-primary disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex items-center gap-3">
      <span id={labelId} className="text-base font-semibold text-heading">
        Quantity
      </span>

      <div className="flex items-center rounded-input border border-border">
        <button
          type="button"
          onClick={() => {
            onChange(value - 1);
          }}
          disabled={disabled || atMin}
          aria-label="Decrease quantity"
          className={button}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>

        <output
          aria-labelledby={labelId}
          aria-live="polite"
          className="w-10 text-center text-base font-semibold text-text tabular-nums"
        >
          {value}
        </output>

        <button
          type="button"
          onClick={() => {
            onChange(value + 1);
          }}
          disabled={disabled || atMax}
          aria-label="Increase quantity"
          className={button}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>

      {atMax && max > 0 && <span className="text-small text-warning">Only {max} available</span>}
    </div>
  );
};
