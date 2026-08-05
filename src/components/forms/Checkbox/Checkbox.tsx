import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useId } from 'react';

import { cn } from '@/utils/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  /** Label content. A node rather than a string, so consent copy can link out. */
  label: ReactNode;
  /** Validation message. Its presence puts the control into the error state. */
  error?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Labelled checkbox for form consent and opt-in controls.
 *
 * The native control is kept and tinted with `accent-color` rather than hidden
 * behind a styled box: it stays keyboard operable, announces its own state, and
 * inherits the platform's focus ring for free.
 */
export const Checkbox = ({ label, error, className, ref, ...props }: CheckboxProps) => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={fieldId}
          ref={ref}
          type="checkbox"
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
          className={cn(
            'mt-0.5 size-4.5 shrink-0 cursor-pointer rounded-input accent-primary',
            className,
          )}
          {...props}
        />

        <label htmlFor={fieldId} className="cursor-pointer text-base text-body">
          {label}
        </label>
      </div>

      {error !== undefined && (
        <p id={errorId} role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
