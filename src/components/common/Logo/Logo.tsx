import { Link } from 'react-router';

import { APP } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

export interface LogoProps {
  /** Renders the wordmark in the inverted palette used on the dark footer. */
  inverted?: boolean;
  className?: string;
}

/**
 * Brand wordmark, always linking home.
 *
 * The mark is drawn as an inline SVG rather than an image so it stays crisp at
 * every density and costs no extra request on the critical path. Both the plate
 * and the glyph resolve their own `currentColor`, which keeps the palette in
 * design tokens instead of literal hex values.
 */
export const Logo = ({ inverted = false, className }: LogoProps) => (
  <Link
    to={ROUTES.HOME}
    className={cn('inline-flex items-center gap-2 rounded-input', className)}
    aria-label={`${APP.name} — home`}
  >
    <svg
      viewBox="0 0 32 32"
      className={cn('size-8 shrink-0', inverted ? 'text-white' : 'text-primary')}
      role="presentation"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />

      <g
        className={inverted ? 'text-primary' : 'text-white'}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 9l8 8 8-8" />
        <path d="M16 17v7" />
      </g>
    </svg>

    <span className={cn('text-h4 font-bold', inverted ? 'text-white' : 'text-heading')}>
      {APP.name}
    </span>
  </Link>
);
