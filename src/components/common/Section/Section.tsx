import type { ReactNode } from 'react';
import { useId } from 'react';

import { Container } from '@/components/common/Container';
import { cn } from '@/utils/cn';

export interface SectionProps {
  /** Section heading. Omit only for a purely decorative band. */
  title?: string;
  /** Supporting copy shown beneath the heading. */
  description?: string;
  /** Action rendered opposite the heading, typically a "View all" link. */
  action?: ReactNode;
  /** Paints the muted section background from design.md. */
  muted?: boolean;
  /** Heading level, so page heading order stays correct. Defaults to `h2`. */
  headingLevel?: 'h2' | 'h3';
  className?: string;
  children: ReactNode;
}

/**
 * Vertical page band with consistent rhythm and an optional titled header.
 *
 * When a title is present the `<section>` is labelled by it, which turns each
 * band into a navigable landmark for screen reader users.
 */
export const Section = ({
  title,
  description,
  action,
  muted = false,
  headingLevel: Heading = 'h2',
  className,
  children,
}: SectionProps) => {
  const headingId = useId();

  return (
    <section
      aria-labelledby={title === undefined ? undefined : headingId}
      className={cn('py-10 md:py-16', muted && 'bg-section', className)}
    >
      <Container>
        {title !== undefined && (
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-10">
            <div className="flex flex-col gap-2">
              <Heading id={headingId} className="text-h4 md:text-h2">
                {title}
              </Heading>

              {description !== undefined && (
                <p className="max-w-2xl text-base text-secondary md:text-lg">{description}</p>
              )}
            </div>

            {action}
          </div>
        )}

        {children}
      </Container>
    </section>
  );
};
