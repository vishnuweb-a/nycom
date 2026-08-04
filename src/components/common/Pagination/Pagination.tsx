import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/utils/cn';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/**
 * Builds the visible page list, collapsing long runs to ellipses:
 * `1 … 4 5 6 … 20`. First and last are always reachable in one click.
 */
const buildPages = (page: number, totalPages: number): (number | string)[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const visible = [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | string)[] = [];
  let previous = 0;

  for (const value of visible) {
    if (previous !== 0 && value - previous > 1) {
      // String entries are gaps; the value keeps the React key stable and unique.
      result.push(`gap-${String(previous)}`);
    }

    result.push(value);
    previous = value;
  }

  return result;
};

/**
 * Page navigation — design.md → Pagination.
 *
 * A `<nav>` landmark with the current page carrying `aria-current="page"`, so
 * position is announced rather than only shown by colour.
 */
export const Pagination = ({ page, totalPages, onChange }: PaginationProps) => {
  if (totalPages <= 1) {
    return null;
  }

  const items = buildPages(page, totalPages);

  return (
    <nav aria-label="Pagination" className="flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          <button
            type="button"
            onClick={() => {
              onChange(page - 1);
            }}
            disabled={page <= 1}
            aria-label="Previous page"
            className="inline-flex size-tap items-center justify-center rounded-input text-body transition-colors hover:bg-primary-light hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
        </li>

        {items.map((item) =>
          typeof item === 'string' ? (
            <li key={item} aria-hidden="true" className="px-2 text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => {
                  onChange(item);
                }}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Page ${String(item)}`}
                className={cn(
                  'inline-flex size-tap items-center justify-center rounded-input text-base font-medium transition-colors',
                  item === page
                    ? 'bg-primary text-white'
                    : 'text-body hover:bg-primary-light hover:text-primary',
                )}
              >
                {item}
              </button>
            </li>
          ),
        )}

        <li>
          <button
            type="button"
            onClick={() => {
              onChange(page + 1);
            }}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="inline-flex size-tap items-center justify-center rounded-input text-body transition-colors hover:bg-primary-light hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  );
};
