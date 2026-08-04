import type { InputHTMLAttributes, Ref } from 'react';
import { useId } from 'react';

import { cn } from '@/utils/cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Visible label. Always rendered — a placeholder is not an accessible label. */
  label: string;
  /** Validation message. Its presence puts the field into the error state. */
  error?: string | undefined;
  /** Guidance shown below the field while it is valid. */
  hint?: string;
  /** Marks the field optional in the label rather than starring every required one. */
  optional?: boolean;
  /** Forwarded to the input by React Hook Form's `register`. */
  ref?: Ref<HTMLInputElement>;
}

/**
 * Labelled text input with error and hint wiring.
 *
 * `aria-invalid` and `aria-describedby` are driven from `error`, so a screen
 * reader announces the failure with the field rather than leaving the message
 * orphaned somewhere below it.
 *
 * Most checkout fields are required, so the label marks the *optional* one
 * instead of decorating eight fields with asterisks.
 */
export const TextField = ({
  label,
  error,
  hint,
  optional = false,
  className,
  ref,
  ...props
}: TextFieldProps) => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-small font-medium text-text">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>

      <input
        id={fieldId}
        ref={ref}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : hint !== undefined ? hintId : undefined}
        className={cn(
          'h-control w-full rounded-input border bg-background px-4 text-base text-text',
          'placeholder:text-muted',
          'transition-colors focus:border-primary',
          error === undefined ? 'border-border hover:border-border-hover' : 'border-danger',
          className,
        )}
        {...props}
      />

      {error !== undefined ? (
        <p id={errorId} role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : (
        hint !== undefined && (
          <p id={hintId} className="text-small text-secondary">
            {hint}
          </p>
        )
      )}
    </div>
  );
};
