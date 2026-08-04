import { use } from 'react';

import { ToastContext, type ToastContextValue } from '@/context/toastContext';

/** Access to transient notifications. Throws outside `ToastProvider`. */
export const useToast = (): ToastContextValue => {
  const context = use(ToastContext);

  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider.');
  }

  return context;
};
