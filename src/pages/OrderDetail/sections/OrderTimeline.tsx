import { Check, XCircle } from 'lucide-react';

import { ORDER_STATUS_LABEL, ORDER_STATUS_SEQUENCE, type OrderStatus } from '@/types/order';
import { cn } from '@/utils/cn';

export interface OrderTimelineProps {
  status: OrderStatus;
}

const STEP_DETAIL: Record<(typeof ORDER_STATUS_SEQUENCE)[number], string> = {
  pending: 'We have received your order.',
  packed: 'Your items are packed and ready.',
  shipped: 'Your order has left our warehouse.',
  out_for_delivery: 'Arriving today — keep cash ready.',
  delivered: 'Delivered. We hope you love it.',
};

/**
 * Fulfilment progress.
 *
 * A cancelled order leaves the sequence entirely rather than showing a
 * half-filled track, which would imply it is still moving.
 *
 * Completed steps carry a tick and a visually hidden "completed" so progress is
 * not conveyed by colour alone.
 */
export const OrderTimeline = ({ status }: OrderTimelineProps) => {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 rounded-card border border-danger/30 bg-danger/5 p-4">
        <XCircle className="size-6 shrink-0 text-danger" aria-hidden="true" />

        <div>
          <p className="text-base font-semibold text-heading">Order cancelled</p>
          <p className="text-small text-secondary">This order will not be delivered.</p>
        </div>
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(status);

  return (
    <ol className="flex flex-col">
      {ORDER_STATUS_SEQUENCE.map((step, index) => {
        const isComplete = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === ORDER_STATUS_SEQUENCE.length - 1;

        return (
          <li key={step} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-pill border-2 transition-colors',
                  isComplete
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-background text-muted',
                )}
              >
                {isComplete ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <span className="size-2 rounded-pill bg-light" aria-hidden="true" />
                )}
              </span>

              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn('w-0.5 flex-1', index < currentIndex ? 'bg-primary' : 'bg-border')}
                />
              )}
            </div>

            <div className={cn('pb-6', isLast && 'pb-0')}>
              <p
                className={cn(
                  'text-base font-semibold',
                  isComplete ? 'text-heading' : 'text-muted',
                )}
              >
                {ORDER_STATUS_LABEL[step]}
                {isComplete && <span className="sr-only"> — completed</span>}
                {isCurrent && (
                  <span className="ml-2 rounded-badge bg-primary-light px-2 py-0.5 text-caption font-semibold text-primary">
                    Current
                  </span>
                )}
              </p>

              <p className="text-small text-secondary">{STEP_DETAIL[step]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
