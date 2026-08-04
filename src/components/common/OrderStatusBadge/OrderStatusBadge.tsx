import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types/order';
import { cn } from '@/utils/cn';

export interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

/** Colour carries meaning, so the label always states the status in words too. */
const TONE: Record<OrderStatus, string> = {
  pending: 'bg-warning/15 text-warning',
  packed: 'bg-primary-light text-primary',
  shipped: 'bg-primary-light text-primary',
  out_for_delivery: 'bg-primary-light text-primary',
  delivered: 'bg-success/15 text-success',
  cancelled: 'bg-danger/10 text-danger',
};

export const OrderStatusBadge = ({ status, className }: OrderStatusBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-badge px-3 py-1 text-caption font-semibold',
      TONE[status],
      className,
    )}
  >
    {ORDER_STATUS_LABEL[status]}
  </span>
);
