export interface PolicyContentsProps {
  /** Clauses in page order; numbering is derived from the position. */
  entries: readonly { readonly id: string; readonly title: string }[];
}

/**
 * "On this page" clause index.
 *
 * A legal page is read by jumping to the clause that applies, so the trail sits
 * beside the content from Laptop up. Below that it is hidden rather than
 * stacked: on a phone the list would push the actual policy a full screen down,
 * and scrolling to a clause is no slower than tapping to it.
 */
export const PolicyContents = ({ entries }: PolicyContentsProps) => (
  <nav aria-label="On this page" className="hidden lg:sticky lg:top-24 lg:block">
    <h2 className="text-caption font-semibold tracking-wide text-secondary uppercase">
      On this page
    </h2>

    <ol className="mt-4 flex flex-col gap-1">
      {entries.map((entry, index) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="block rounded-input py-1 text-base text-secondary transition-colors hover:text-primary"
          >
            <span className="mr-2 text-muted">{index + 1}.</span>
            {entry.title}
          </a>
        </li>
      ))}
    </ol>
  </nav>
);
