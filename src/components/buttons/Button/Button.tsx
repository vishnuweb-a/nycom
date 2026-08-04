import type { VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { buttonVariants } from '@/components/buttons/Button/buttonVariants';
import { cn } from '@/utils/cn';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Replaces the label with a spinner and blocks interaction. */
  isLoading?: boolean;
  /** Announced to screen readers while `isLoading` is true. */
  loadingLabel?: string;
  children: ReactNode;
}

/**
 * The single button primitive for the application. Never re-style a raw
 * `<button>`; add a variant to `buttonVariants` instead.
 *
 * For a navigation action, render a `<Link>` with `buttonVariants()` as its
 * className rather than wrapping one in a button.
 */
export const Button = ({
  variant,
  size,
  fullWidth,
  isLoading = false,
  loadingLabel = 'Loading',
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type === 'submit' ? 'submit' : type === 'reset' ? 'reset' : 'button'}
    disabled={disabled ?? isLoading}
    aria-busy={isLoading}
    className={cn(buttonVariants({ variant, size, fullWidth }), className)}
    {...props}
  >
    {isLoading ? (
      <>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span className="sr-only">{loadingLabel}</span>
      </>
    ) : (
      children
    )}
  </button>
);
