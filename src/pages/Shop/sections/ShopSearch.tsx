import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { SEARCH_DEBOUNCE_MS } from '@/constants/shop';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface ShopSearchProps {
  /** Current term from the URL. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Shop search field — prd.md §8 Search Section.
 *
 * Typing updates local state immediately and the URL only after a pause, so the
 * field stays responsive and the address bar does not gain a history entry per
 * keystroke.
 */
export const ShopSearch = ({ value, onChange }: ShopSearchProps) => {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);
  const lastPushed = useRef(value);

  // Push the settled term outward, but never echo back a value we just sent.
  useEffect(() => {
    if (debounced !== lastPushed.current) {
      lastPushed.current = debounced;
      onChange(debounced);
    }
  }, [debounced, onChange]);

  // Adopt external changes — a category link or Clear all resetting the term.
  useEffect(() => {
    if (value !== lastPushed.current) {
      lastPushed.current = value;
      setDraft(value);
    }
  }, [value]);

  return (
    <search>
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>

      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-4 size-5 text-muted"
          aria-hidden="true"
        />

        <input
          id={inputId}
          type="search"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Search for Shirts, Hoodies, Jeans..."
          enterKeyHint="search"
          className="h-control w-full rounded-pill bg-search pr-12 pl-12 text-base text-text placeholder:text-muted focus:bg-background"
        />

        {draft !== '' && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
            }}
            aria-label="Clear search"
            className="absolute right-2 inline-flex size-tap items-center justify-center rounded-pill text-muted hover:text-primary"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </search>
  );
};
