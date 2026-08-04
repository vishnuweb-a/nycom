import { PackageCheck, RotateCcw, Truck } from 'lucide-react';

import { DELIVERY_DAYS, estimatedDeliveryRange, RETURN_WINDOW_DAYS } from '@/constants/commerce';

/**
 * Delivery method.
 *
 * A single static card rather than a chooser: Standard is the only method this
 * MVP offers, and a radio group with one option is a control that cannot change
 * anything.
 */
export const DeliveryCard = () => (
  <section
    aria-labelledby="delivery-method"
    className="rounded-card border border-border p-4 md:p-6"
  >
    <div className="mb-5 flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light text-primary">
        <Truck className="size-5" aria-hidden="true" />
      </span>

      <div>
        <h2 id="delivery-method" className="text-h5 text-heading">
          Delivery
        </h2>
        <p className="text-small text-secondary">How your order reaches you</p>
      </div>
    </div>

    <div className="rounded-card border border-primary bg-primary-light p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-heading">Standard delivery</p>
          <p className="text-small text-body">
            {DELIVERY_DAYS.min}–{DELIVERY_DAYS.max} business days
          </p>
        </div>

        <span className="rounded-badge bg-success px-3 py-1 text-caption font-semibold text-white">
          FREE
        </span>
      </div>

      <p className="mt-3 text-base text-body">
        Estimated arrival{' '}
        <span className="font-semibold text-heading">{estimatedDeliveryRange()}</span>
      </p>
    </div>

    <ul className="mt-4 flex flex-col gap-2 xs:flex-row xs:gap-6">
      {[
        { icon: RotateCcw, label: `${String(RETURN_WINDOW_DAYS)}-day easy returns` },
        { icon: PackageCheck, label: 'Secure packaging' },
      ].map((promise) => {
        const Icon = promise.icon;

        return (
          <li key={promise.label} className="flex items-center gap-2 text-base text-body">
            <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {promise.label}
          </li>
        );
      })}
    </ul>
  </section>
);
