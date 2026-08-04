import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

import { ToastContext, type Toast, type ToastTone } from '@/context/toastContext';
import { cn } from '@/utils/cn';

/** How long a message stays on screen. */
const TOAST_DURATION_MS = 3500;

/** Cap so a rapid burst cannot fill the viewport. */
const MAX_VISIBLE = 3;

const TONE_ICON = {
  success: CheckCircle2,
  info: Info,
  error: AlertCircle,
} as const;

const TONE_STYLE: Record<ToastTone, string> = {
  success: 'border-success text-success',
  info: 'border-primary text-primary',
  error: 'border-danger text-danger',
};

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Transient feedback for actions that change state without navigating —
 * principally adding to the cart.
 *
 * The region is a polite live region so a screen reader announces the outcome
 * without stealing focus, which would interrupt someone mid-task. Messages are
 * dismissible for anyone who wants them gone sooner.
 */
export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      nextId.current += 1;
      const id = nextId.current;

      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, message, tone }]);

      window.setTimeout(() => {
        dismiss(id);
      }, TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext value={value}>
      {children}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-auto md:items-end"
      >
        {toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone];

          return (
            <div
              key={toast.id}
              className={cn(
                'max-w-sm pointer-events-auto flex w-full items-center gap-3 rounded-card border-l-4 bg-white px-4 py-3 shadow-modal',
                TONE_STYLE[toast.tone],
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />

              <p className="flex-1 text-base text-text">{toast.message}</p>

              <button
                type="button"
                onClick={() => {
                  dismiss(toast.id);
                }}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-input px-2 text-small font-semibold text-secondary hover:text-primary"
              >
                Close
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
};
