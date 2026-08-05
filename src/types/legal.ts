/**
 * Shapes for statutory disclosure pages — Terms, Refund & Cancellation, and the
 * policy pages that follow.
 *
 * Legal copy is authored as data rather than markup so a page component stays
 * about layout and a wording change never touches JSX. Two inline markers are
 * understood by `PolicyText`, and nothing else parses them:
 *
 *   `**emphasis**`          → <strong>, for deadlines and the entity name
 *   `[[Label|/route]]`      → an internal <Link>
 */

/** A paragraph, or a bulleted list of short statements. */
export type PolicyBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] };

/** One numbered clause of a policy. */
export interface PolicySection {
  /** Anchor target and `aria-labelledby` target. Stable — it can be linked to. */
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly PolicyBlock[];
}

/**
 * The closing "Contact us" clause. Its body is rendered from `COMPANY` rather
 * than from prose, so the registered office reads identically on every page.
 */
export interface LegalContact {
  readonly id: string;
  readonly title: string;
  /** Optional lead-in sentence above the contact details. */
  readonly intro?: string;
}

/** Publication date of a policy, in both readable and machine forms. */
export interface EffectiveDate {
  /** As published, e.g. "August 5, 2026". */
  readonly label: string;
  /** ISO 8601, for `<time dateTime>`. */
  readonly iso: string;
}
