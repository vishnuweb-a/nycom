import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface StatusMessageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Recovery affordance — a retry button or a link onwards. */
  action?: ReactNode;
  /** Errors are announced assertively; empty states are not announced at all. */
  tone?: 'empty' | 'error';
  className?: string;
}

/**
 * Centred message for empty and error states.
 *
 * One component covers both because they are the same layout with different
 * semantics: an error is a live region so a retry outcome is announced, while
 * an empty result is ordinary content.
 */
export const StatusMessage = ({
  icon: Icon,
  title,
  description,
  action,
  tone = 'empty',
  className,
}: StatusMessageProps) => (
  <div
    role={tone === 'error' ? 'alert' : undefined}
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-card bg-surface px-6 py-12 text-center',
      className,
    )}
  >
    <span
      className={cn(
        'flex size-12 items-center justify-center rounded-pill',
        tone === 'error' ? 'bg-danger/10 text-danger' : 'bg-primary-light text-primary',
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
    </span>

    <h3 className="text-h5 text-heading">{title}</h3>
    <p className="max-w-sm text-base text-secondary">{description}</p>

    {action}
  </div>
);
