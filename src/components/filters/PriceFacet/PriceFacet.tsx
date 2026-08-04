import { useId, useState } from 'react';

import { Button } from '@/components/buttons/Button';
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/cn';

export interface PriceFacetProps {
  floor: number;
  ceiling: number;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}

/** Builds four evenly spaced bands across the catalogue's price span. */
const buildBands = (floor: number, ceiling: number) => {
  const step = Math.max(1, Math.round((ceiling - floor) / 4));

  return [0, 1, 2, 3].map((index) => {
    const from = floor + step * index;
    const to = index === 3 ? ceiling : from + step;

    return { from, to, label: `${formatPrice(from)} – ${formatPrice(to)}` };
  });
};

/**
 * Price range filter.
 *
 * Uses two number inputs plus quick bands rather than a dual-thumb slider:
 * a slider needs pointer precision that fails on touch, while paired number
 * inputs are keyboard-operable, screen-reader friendly and let a shopper type
 * an exact budget. This is a deliberate departure from design.md's "Price
 * Slider".
 *
 * Local state holds the draft so typing is not debounced into the URL midway
 * through entering a number; the value commits on submit or on band choice.
 */
export const PriceFacet = ({ floor, ceiling, min, max, onChange }: PriceFacetProps) => {
  const minId = useId();
  const maxId = useId();

  const [draftMin, setDraftMin] = useState(min === null ? '' : String(min));
  const [draftMax, setDraftMax] = useState(max === null ? '' : String(max));
  const [committed, setCommitted] = useState({ min, max });

  // Resync when the range changes from elsewhere — a band chip, Clear all, or
  // the back button. Adjusting state during render is React's documented
  // pattern for this; an effect would render once with the stale value first.
  if (committed.min !== min || committed.max !== max) {
    setCommitted({ min, max });
    setDraftMin(min === null ? '' : String(min));
    setDraftMax(max === null ? '' : String(max));
  }

  const commit = () => {
    const parsedMin = draftMin.trim() === '' ? null : Number(draftMin);
    const parsedMax = draftMax.trim() === '' ? null : Number(draftMax);

    const safeMin = parsedMin !== null && Number.isFinite(parsedMin) ? parsedMin : null;
    const safeMax = parsedMax !== null && Number.isFinite(parsedMax) ? parsedMax : null;

    // Swap rather than reject when the shopper enters them the wrong way round.
    if (safeMin !== null && safeMax !== null && safeMin > safeMax) {
      onChange(safeMax, safeMin);
      return;
    }

    onChange(safeMin, safeMax);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted">
        {formatPrice(floor)} – {formatPrice(ceiling)} across this selection
      </p>

      <ul className="flex flex-wrap gap-2">
        {buildBands(floor, ceiling).map((band) => {
          const isActive = min === band.from && max === band.to;

          return (
            <li key={band.label}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  onChange(isActive ? null : band.from, isActive ? null : band.to);
                }}
                className={cn(
                  'min-h-tap rounded-pill border px-3 text-small font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border text-body hover:border-border-hover',
                )}
              >
                {band.label}
              </button>
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
        className="flex items-end gap-2"
      >
        <div className="flex-1">
          <label htmlFor={minId} className="mb-1 block text-caption text-secondary">
            Min
          </label>
          <input
            id={minId}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={String(floor)}
            value={draftMin}
            onChange={(event) => {
              setDraftMin(event.target.value);
            }}
            className="h-tap w-full rounded-input border border-border bg-background px-3 text-base text-text placeholder:text-muted focus:border-primary"
          />
        </div>

        <div className="flex-1">
          <label htmlFor={maxId} className="mb-1 block text-caption text-secondary">
            Max
          </label>
          <input
            id={maxId}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={String(ceiling)}
            value={draftMax}
            onChange={(event) => {
              setDraftMax(event.target.value);
            }}
            className="h-tap w-full rounded-input border border-border bg-background px-3 text-base text-text placeholder:text-muted focus:border-primary"
          />
        </div>

        <Button type="submit" size="sm" variant="secondary">
          Go
        </Button>
      </form>
    </div>
  );
};
