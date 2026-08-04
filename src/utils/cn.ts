import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge ships with knowledge of Tailwind's *default* scales. The design
 * system in `styles/global.css` resets those scales to `initial` and defines its
 * own, so the default theme is re-declared here. Without this, conflicting pairs
 * such as `text-h1 text-h2` or `rounded-card rounded-product` would both survive
 * a merge and the last-writer-wins contract of `className` would silently break.
 *
 * Keep these lists in sync with the `@theme` block in `styles/global.css`.
 */
const twMerge = extendTailwindMerge({
  override: {
    theme: {
      text: ['caption', 'small', 'base', 'lg', 'button', 'h5', 'h4', 'h3', 'h2', 'h1', 'price'],
      color: [
        'transparent',
        'current',
        'white',
        'black',
        'primary',
        'primary-hover',
        'primary-light',
        'accent',
        'success',
        'warning',
        'danger',
        'background',
        'surface',
        'section',
        'hover',
        'placeholder',
        'search',
        'footer',
        'heading',
        'text',
        'body',
        'secondary',
        'muted',
        'light',
        'border',
        'border-hover',
      ],
      radius: ['button', 'input', 'card', 'image', 'product', 'hero', 'badge', 'pill'],
      shadow: ['card', 'card-hover', 'modal'],
      container: ['page', 'content'],
      ease: ['standard'],
    },
  },
});

/**
 * Merges conditional class names and resolves conflicting Tailwind utilities so
 * a consumer's `className` prop reliably overrides a component's own defaults.
 *
 * @example
 * cn('px-4 text-base', isActive && 'text-primary', className)
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
