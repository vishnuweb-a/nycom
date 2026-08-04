import { BadgeIndianRupee, Lock, RotateCcw, Truck } from 'lucide-react';

import { RETURN_WINDOW_DAYS } from '@/constants/commerce';

/**
 * Reassurance strip shown at the point of decision.
 *
 * Content is fixed rather than configurable — there is exactly one set of
 * promises, and a props API for four static items would be indirection without
 * a second caller to justify it.
 */
const BADGES = [
  { icon: BadgeIndianRupee, label: 'Cash on Delivery' },
  { icon: RotateCcw, label: `${String(RETURN_WINDOW_DAYS)}-day easy returns` },
  { icon: Lock, label: 'Secure checkout' },
  { icon: Truck, label: 'Fast delivery' },
] as const;

export const TrustBadges = () => (
  <section aria-label="Our promises" className="rounded-card bg-surface p-4">
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {BADGES.map((badge) => {
        const Icon = badge.icon;

        return (
          <li key={badge.label} className="flex items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-primary-light text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>

            <span className="text-small font-medium text-text">{badge.label}</span>
          </li>
        );
      })}
    </ul>
  </section>
);
