import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';

/** `[[Label|/route]]` — an internal link inside policy copy. */
const LINK_PATTERN = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

/** Wraps every `**emphasised**` span of a plain chunk in `<strong>`. */
const withEmphasis = (text: string): ReactNode[] =>
  text.split('**').map((part, index) =>
    // Odd segments sit between a pair of markers, so they are the emphasis.
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-heading">
        {part}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );

/**
 * Policy copy with its two inline markers resolved — see `types/legal.ts`.
 *
 * A legal page needs a handful of bold deadlines and the occasional link to a
 * sibling policy. A twenty-line renderer keeps the copy in plain data files
 * without pulling a markdown parser into the bundle for that.
 */
export const PolicyText = ({ text }: { text: string }) => {
  // `split` with two capture groups yields repeating [plain, label, href, …].
  const chunks = text.split(LINK_PATTERN);

  return (
    <>
      {chunks.map((chunk, index) => {
        const position = index % 3;

        if (position === 0) {
          return <Fragment key={index}>{withEmphasis(chunk)}</Fragment>;
        }

        // The href is consumed alongside its label, so it renders nothing here.
        const href = chunks[index + 1];

        if (position === 2 || href === undefined) {
          return null;
        }

        return (
          <Link
            key={index}
            to={href}
            className="rounded-input font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary-hover"
          >
            {chunk}
          </Link>
        );
      })}
    </>
  );
};
