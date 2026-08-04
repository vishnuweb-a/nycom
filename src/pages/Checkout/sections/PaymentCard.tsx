import { Check, PackageCheck } from 'lucide-react';

/**
 * Cash on Delivery — the only payment method this MVP supports.
 *
 * Presented as a confirmed selection rather than a choice: with one method, a
 * radio button implies alternatives that do not exist. No card, UPI, wallet,
 * net banking, EMI or pay-later option appears anywhere, and no payment form is
 * collected.
 */
export const PaymentCard = () => (
  <section
    aria-labelledby="payment-method"
    className="rounded-card border border-border p-4 md:p-6"
  >
    <div className="mb-5 flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light text-primary">
        <PackageCheck className="size-5" aria-hidden="true" />
      </span>

      <div>
        <h2 id="payment-method" className="text-h5 text-heading">
          Payment method
        </h2>
        <p className="text-small text-secondary">Cash on Delivery is our supported option</p>
      </div>
    </div>

    <div className="rounded-card border-2 border-primary bg-primary-light p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-h4">
            📦
          </span>

          <div>
            <p className="text-h5 text-heading">Cash on Delivery</p>
            <p className="text-base text-body">Pay when your order arrives.</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="rounded-badge bg-success px-3 py-1 text-caption font-semibold text-white">
            Available
          </span>
          <span className="text-base font-bold text-success">FREE</span>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 xs:grid-cols-2">
        {[
          'Cash accepted at delivery',
          'Secure order confirmation',
          'No advance payment',
          'Available for your location',
        ].map((benefit) => (
          <li key={benefit} className="flex items-center gap-2 text-base text-body">
            <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
            {benefit}
          </li>
        ))}
      </ul>
    </div>

    <p className="mt-4 text-base text-secondary">
      Your order will be confirmed immediately. Payment will be collected by the delivery partner at
      the time of delivery.
    </p>
  </section>
);
