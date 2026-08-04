import { cva } from 'class-variance-authority';

/**
 * Shared button styling.
 *
 * Lives in its own module so `Button.tsx` exports only a component, which keeps
 * React Fast Refresh working during development.
 *
 * Exported so `<Link>` can adopt the exact same appearance without nesting an
 * anchor inside a button:
 *
 * @example
 * <Link to={ROUTES.SHOP} className={buttonVariants({ variant: 'secondary' })}>
 *   Continue shopping
 * </Link>
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-button text-button font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'border border-primary bg-background text-primary hover:bg-primary-light',
        ghost: 'text-body hover:bg-hover',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        // Both sizes clear the 44px minimum tap target from design.md.
        sm: 'h-tap px-4',
        md: 'h-control px-6',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
);
