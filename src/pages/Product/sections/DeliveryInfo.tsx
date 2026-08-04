import { BadgeIndianRupee, RotateCcw, ShieldCheck, Truck } from 'lucide-react';

import {
  estimatedDeliveryRange,
  FREE_SHIPPING_THRESHOLD,
  RETURN_WINDOW_DAYS,
} from '@/constants/commerce';
import { formatPrice } from '@/utils/format';

/**
 * Delivery, payment and returns assurances.
 *
 * Static policy, but sourced from `constants/commerce.ts` so the figures cannot
 * drift from what Cart and Checkout quote.
 */
export const DeliveryInfo = () => {
  const promises = [
    {
      icon: Truck,
      title: 'Estimated delivery',
      detail: estimatedDeliveryRange(),
    },
    {
      icon: BadgeIndianRupee,
      title: 'Cash on Delivery',
      detail: 'Pay in cash when your order arrives.',
    },
    {
      icon: RotateCcw,
      title: `${String(RETURN_WINDOW_DAYS)}-day easy returns`,
      detail: 'Return any unworn piece, no questions asked.',
    },
    {
      icon: ShieldCheck,
      title: 'Secure payments',
      detail: `Free shipping on orders above ${formatPrice(FREE_SHIPPING_THRESHOLD)}.`,
    },
  ] as const;

  return (
    <section aria-labelledby="delivery-info" className="rounded-card border border-border p-4">
      <h2 id="delivery-info" className="sr-only">
        Delivery and returns
      </h2>

      <ul className="flex flex-col gap-4">
        {promises.map((promise) => {
          const Icon = promise.icon;

          return (
            <li key={promise.title} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>

              <div className="flex flex-col">
                <span className="text-base font-semibold text-heading">{promise.title}</span>
                <span className="text-base text-secondary">{promise.detail}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
