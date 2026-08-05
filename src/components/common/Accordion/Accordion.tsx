import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface AccordionItem {
  readonly id: string;
  readonly question: string;
  readonly answer: ReactNode;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  /** Heading level for each question, so page heading order stays correct. */
  headingLevel?: 'h3' | 'h4';
  className?: string;
}

/**
 * Expandable question and answer list.
 *
 * Panels open independently rather than as an exclusive set: someone comparing
 * two answers should not have the first one close as they open the second.
 *
 * The open transition animates `grid-template-rows` from `0fr` to `1fr`, which
 * gives a real height animation without measuring the panel in JavaScript. A
 * closed panel keeps its content in the DOM for that animation, so it is marked
 * `inert` — otherwise its links would still take keyboard focus while hidden.
 */
export const Accordion = ({ items, headingLevel: Heading = 'h3', className }: AccordionProps) => {
  const [openIds, setOpenIds] = useState<readonly string[]>([]);
  const baseId = useId();

  const toggle = (id: string) => {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((openId) => openId !== id) : [...current, id],
    );
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;

        return (
          <div
            key={item.id}
            className="rounded-card border border-border bg-background shadow-card transition-shadow hover:shadow-card-hover"
          >
            <Heading>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => {
                  toggle(item.id);
                }}
                className="flex w-full items-center justify-between gap-4 rounded-card px-5 py-5 text-left transition-colors hover:text-primary md:px-6"
              >
                <span className="text-base font-semibold text-heading md:text-h5">
                  {item.question}
                </span>

                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-pill bg-primary-light text-primary transition-transform',
                    isOpen && 'rotate-180',
                  )}
                >
                  <ChevronDown className="size-4" aria-hidden="true" />
                </span>
              </button>
            </Heading>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!isOpen}
              className={cn(
                'grid transition-[grid-template-rows]',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-5 text-base text-body md:px-6 md:pb-6">{item.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
