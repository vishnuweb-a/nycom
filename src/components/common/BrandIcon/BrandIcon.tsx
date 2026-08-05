import type { SVGProps } from 'react';

/** Social platforms the storefront maintains a profile on. */
export type BrandName = 'instagram' | 'facebook' | 'x' | 'linkedin';

export interface BrandIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: BrandName;
}

/**
 * Social platform marks, drawn to match the Lucide icons used everywhere else.
 *
 * `lucide-react` 1.x removed every brand glyph, so these are hand-drawn on the
 * same 24px grid with the same 2px round-capped stroke. Keeping the Lucide
 * drawing style — rather than importing filled logo paths — means a row of
 * social buttons sits beside a `Mail` or `Phone` icon without one looking
 * heavier than the other.
 *
 * Always decorative here: every call site pairs the icon with a visible or
 * screen-reader-only platform name, so the `<svg>` is hidden from the
 * accessibility tree.
 */
export const BrandIcon = ({ name, ...props }: BrandIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {name === 'instagram' && (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" />
      </>
    )}

    {name === 'facebook' && (
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    )}

    {name === 'x' && (
      <>
        <path d="M4 3h4l12 18h-4z" />
        <path d="M19.5 3 13 10.5" />
        <path d="M11 13.5 4.5 21" />
      </>
    )}

    {name === 'linkedin' && (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </>
    )}
  </svg>
);
