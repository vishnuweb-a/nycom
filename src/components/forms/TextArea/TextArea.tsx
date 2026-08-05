import type { Ref, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

import { cn } from '@/utils/cn';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  /** Visible label. Always rendered — a placeholder is not an accessible label. */
  label: string;
  /** Validation message. Its presence puts the field into the error state. */
  error?: string | undefined;
  /** Guidance shown below the field while it is valid. */
  hint?: string;
  /** Marks the field optional in the label. */
  optional?: boolean;
  /** Renders the required asterisk beside the label. */
  requiredMark?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Multi-line counterpart to `TextField`, with the same label, hint and error
 * wiring so a form can mix the two without a visual seam.
 */
export const TextArea = ({
  label,
  error,
  hint,
  optional = false,
  requiredMark = false,
  rows = 5,
  className,
  ref,
  ...props
}: TextAreaProps) => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-small font-medium text-text">
        {label}
        {requiredMark && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>

      <textarea
        id={fieldId}
        ref={ref}
        rows={rows}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : hint !== undefined ? hintId : undefined}
        className={cn(
          'w-full resize-y rounded-input border bg-background px-4 py-3 text-base text-text',
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
