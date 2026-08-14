import { Check, CreditCard, PackageCheck, ShieldCheck } from 'lucide-react';

import type { PaymentMethod } from '@/types/order';
import { cn } from '@/utils/cn';

interface PaymentCardProps {
  readonly value: PaymentMethod;
  readonly onChange: (method: PaymentMethod) => void;
  /** Locks the choice while a payment is being prepared. */
  readonly disabled?: boolean;
}

const COD_BENEFITS = [
  'Cash accepted at delivery',
  'Secure order confirmation',
  'No advance payment',
  'Available for your location',
] as const;

const ONLINE_BENEFITS = [
  'UPI, cards and net banking',
  'Payment handled by Airpay',
  'Card details never reach us',
  'Instant order confirmation',
] as const;

/**
 * Payment method selection.
 *
 * Now a genuine choice, so it is a real radio group: two `<input type="radio">`
 * elements sharing a name, wrapped in a `<fieldset>` with a `<legend>`. Arrow
 * keys move between them and the browser announces "1 of 2" — behaviour that
 * clickable `<div>`s would silently lose.
 *
 * Cash on Delivery remains the default. It is the method this storefront has
 * always supported, and defaulting to the option that takes money would be a
 * change nobody asked for.
 */
export const PaymentCard = ({ value, onChange, disabled = false }: PaymentCardProps) => (
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
        <p className="text-small text-secondary">Choose how you&apos;d like to pay</p>
      </div>
    </div>

    <fieldset disabled={disabled} className="flex flex-col gap-3">
      <legend className="sr-only">Select a payment method</legend>

      <PaymentOption
        method="cod"
        checked={value === 'cod'}
        onChange={onChange}
        icon={
          <span aria-hidden="true" className="text-h4">
            📦
          </span>
        }
        title="Cash on Delivery"
        description="Pay when your order arrives."
        badge={{ label: 'Available', tone: 'success' }}
        trailing="FREE"
        benefits={COD_BENEFITS}
      />

      <PaymentOption
        method="airpay"
        checked={value === 'airpay'}
        onChange={onChange}
        icon={<CreditCard className="size-6" aria-hidden="true" />}
        title="Pay Online"
        description="UPI, credit or debit card, net banking or wallet."
        badge={{ label: 'Secure', tone: 'primary' }}
        benefits={ONLINE_BENEFITS}
      />
    </fieldset>

    <p className="mt-4 flex items-start gap-2 text-base text-secondary">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      {value === 'cod'
        ? 'Your order will be confirmed immediately. Payment will be collected by the delivery partner at the time of delivery.'
        : 'You will be taken to Airpay to complete payment. Yarnvia never sees or stores your card or UPI details.'}
    </p>
  </section>
);

interface PaymentOptionProps {
  readonly method: PaymentMethod;
  readonly checked: boolean;
  readonly onChange: (method: PaymentMethod) => void;
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly badge: { readonly label: string; readonly tone: 'success' | 'primary' };
  readonly trailing?: string;
  readonly benefits: readonly string[];
}

const PaymentOption = ({
  method,
  checked,
  onChange,
  icon,
  title,
  description,
  badge,
  trailing,
  benefits,
}: PaymentOptionProps) => (
  <label
    className={cn(
      'block cursor-pointer rounded-card border-2 p-4 transition-colors md:p-5',
      'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
      checked ? 'border-primary bg-primary-light' : 'border-border hover:border-primary/40',
    )}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <input
          type="radio"
          name="paymentMethod"
          value={method}
          checked={checked}
          onChange={() => {
            onChange(method);
          }}
          className="mt-1 size-4 shrink-0 accent-primary"
        />

        <span className="flex items-center text-primary">{icon}</span>

        <div>
          <p className="text-h5 text-heading">{title}</p>
          <p className="text-base text-body">{description}</p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <span
          className={cn(
            'rounded-badge px-3 py-1 text-caption font-semibold text-white',
            badge.tone === 'success' ? 'bg-success' : 'bg-primary',
          )}
        >
          {badge.label}
        </span>

        {trailing !== undefined && (
          <span className="text-base font-bold text-success">{trailing}</span>
        )}
      </div>
    </div>

    {checked && (
      <ul className="mt-4 grid gap-2 xs:grid-cols-2">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2 text-base text-body">
            <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
            {benefit}
          </li>
        ))}
      </ul>
    )}
  </label>
);
