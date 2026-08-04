import { Search } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { SEARCH_QUERY_PARAM } from '@/constants/search';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

export interface SearchBarProps {
  /** Called after a successful submit, e.g. to close the mobile search sheet. */
  onSubmitted?: () => void;
  className?: string;
}

/**
 * Product search entry point.
 *
 * Submitting navigates to `/shop?q=…` so a search is a real, shareable and
 * back-button-friendly URL rather than transient component state. The Shop page
 * reads the same parameter, which keeps search state in one place.
 */
export const SearchBar = ({ onSubmitted, className }: SearchBarProps) => {
  const inputId = useId();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [term, setTerm] = useState(() => searchParams.get(SEARCH_QUERY_PARAM) ?? '');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = term.trim();
    const target =
      trimmed === ''
        ? ROUTES.SHOP
        : `${ROUTES.SHOP}?${SEARCH_QUERY_PARAM}=${encodeURIComponent(trimmed)}`;

    void navigate(target);
    onSubmitted?.();
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn('w-full max-w-searchbar', className)}
      aria-label="Search products"
    >
      <label htmlFor={inputId} className="sr-only">
        Search for products
      </label>

      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-4 size-5 text-muted"
          aria-hidden="true"
        />

        <input
          id={inputId}
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
          }}
          placeholder="Search for Shirts, Hoodies, Jeans..."
          className="h-control w-full rounded-pill bg-search pr-4 pl-12 text-base text-text placeholder:text-muted focus:bg-background"
          enterKeyHint="search"
        />
      </div>
    </form>
  );
};
