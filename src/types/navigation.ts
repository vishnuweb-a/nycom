import type { LucideIcon } from 'lucide-react';

/** A destination that resolves to a real application route. */
export interface NavLink {
  readonly label: string;
  readonly path: string;
}

/** A navigation destination rendered with an icon, as in the mobile bottom bar. */
export interface IconNavLink extends NavLink {
  readonly icon: LucideIcon;
  /**
   * When true the link is active only on an exact path match. Used for `/` so
   * that it does not stay highlighted on every nested route.
   */
  readonly exact?: boolean;
}

/** A titled group of links, used to build the footer columns. */
export interface NavGroup {
  readonly title: string;
  readonly links: readonly NavLink[];
}

/**
 * An external social profile.
 *
 * Rendered as a text link rather than a brand glyph: lucide-react 1.x removed
 * all brand icons, and `design.md` names Lucide as the icon library.
 */
export interface SocialLink {
  readonly label: string;
  readonly href: string;
}
