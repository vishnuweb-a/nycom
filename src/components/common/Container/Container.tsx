import type { ElementType, ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface ContainerProps {
  /** Semantic element to render. Defaults to `div`. */
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/**
 * Centred content column: 1320px maximum with the 16 / 24 / 32px responsive
 * horizontal padding from design.md.
 *
 * Wraps the `container-page` utility so pages never re-derive page gutters.
 */
export const Container = ({ as: Component = 'div', className, children }: ContainerProps) => (
  <Component className={cn('container-page', className)}>{children}</Component>
);
