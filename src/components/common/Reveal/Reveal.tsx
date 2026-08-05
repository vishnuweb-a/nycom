import type { ReactNode } from 'react';

import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';
import { cn } from '@/utils/cn';

/** Stagger step, in the order items should arrive. `0` starts immediately. */
export type RevealDelay = 0 | 1 | 2 | 3 | 4;

const DELAY_CLASS: Record<RevealDelay, string> = {
  0: '',
  1: 'reveal-delay-1',
  2: 'reveal-delay-2',
  3: 'reveal-delay-3',
  4: 'reveal-delay-4',
};

export interface RevealProps {
  /** Position in a staggered group. Omit for a single element. */
  delay?: RevealDelay;
  className?: string;
  children: ReactNode;
}

/**
 * Fades and lifts its children into place as they scroll into view.
 *
 * A presentational wrapper only — it renders a plain `div`, so the semantic
 * element (`section`, `article`, `li`) stays with the content inside it.
 *
 * Before the reveal the element is transparent but still occupies its space, so
 * nothing reflows when the entrance runs.
 */
export const Reveal = ({ delay = 0, className, children }: RevealProps) => {
  const { ref, revealed } = useRevealOnScroll<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(revealed ? cn('reveal', DELAY_CLASS[delay]) : 'opacity-0', className)}
    >
      {children}
    </div>
  );
};
