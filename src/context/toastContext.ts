import { createContext } from 'react';

export type ToastTone = 'success' | 'info' | 'error';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

export interface ToastContextValue {
  /** Shows a transient message. Returns nothing — toasts are fire-and-forget. */
  readonly showToast: (message: string, tone?: ToastTone) => void;
}

/**
 * Toast context object, kept apart from the provider component so neither file
 * exports both a component and a non-component, which breaks Fast Refresh.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);
