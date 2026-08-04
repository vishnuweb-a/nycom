import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Action row, rendered at the foot of the dialog. */
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Centred modal dialog.
 *
 * Implements the dialog pattern directly rather than adding a UI library for
 * one consumer: focus moves in on open and returns to the trigger on close, Tab
 * is trapped, Escape dismisses, and the page behind is locked from scrolling.
 *
 * The same contract as `Drawer`, but centred rather than a bottom sheet — a
 * confirmation is a decision point, not a panel of options, so it should sit in
 * the middle of the viewport on every breakpoint.
 */
export const Modal = ({ open, onClose, title, footer, children }: ModalProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || panelRef.current === null) {
        return;
      }

      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      );

      const first = focusable.at(0);
      const last = focusable.at(-1);

      if (first === undefined || last === undefined) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-md animate-rise-in flex-col gap-4 rounded-card bg-background p-6 shadow-modal"
      >
        <h2 id={titleId} className="text-h5 text-heading md:text-h4">
          {title}
        </h2>

        <div className="text-base text-body">{children}</div>

        {footer !== undefined && <div className="flex flex-col gap-3 xs:flex-row">{footer}</div>}
      </div>
    </div>
  );
};
