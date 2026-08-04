import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface FilterGroupProps {
  title: string;
  /** Number of active selections, shown beside the title. */
  selectedCount?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible filter section — design.md → Sidebar Filters → Accordion.
 *
 * A native `<button>` toggles a region wired with `aria-expanded` and
 * `aria-controls`, so the disclosure state is announced rather than implied by
 * the chevron alone.
 */
export const FilterGroup = ({
  title,
  selectedCount = 0,
  defaultOpen = true,
  children,
}: FilterGroupProps) => {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((previous) => !previous);
          }}
          className="flex min-h-tap w-full items-center justify-between gap-2 rounded-input text-left text-base font-semibold text-heading"
        >
          <span className="flex items-center gap-2">
            {title}
            {selectedCount > 0 && (
              <span className="rounded-pill bg-primary px-2 py-0.5 text-caption font-semibold text-white">
                {selectedCount}
              </span>
            )}
          </span>

          <ChevronDown
            className={cn(
              'size-5 shrink-0 text-secondary transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </h3>

      <div id={panelId} hidden={!open} className="pt-3">
        {children}
      </div>
    </div>
  );
};
