import { MapPin } from 'lucide-react';
import type { UseFormRegister } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';

import { TextField } from '@/components/forms/TextField/TextField';
import type { AddressFormValues } from '@/pages/Checkout/addressSchema';

export interface AddressFormProps {
  register: UseFormRegister<AddressFormValues>;
  errors: FieldErrors<AddressFormValues>;
}

/**
 * Shipping address fields.
 *
 * Presentation only — the form instance lives on the checkout page, because the
 * submit handler needs it too. Each input carries the right `autoComplete`
 * token so a browser or password manager can fill the whole address in one go,
 * which is the single biggest usability win on any checkout.
 */
export const AddressForm = ({ register, errors }: AddressFormProps) => (
  <section
    aria-labelledby="shipping-address"
    className="rounded-card border border-border p-4 md:p-6"
  >
    <div className="mb-5 flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light text-primary">
        <MapPin className="size-5" aria-hidden="true" />
      </span>

      <div>
        <h2 id="shipping-address" className="text-h5 text-heading">
          Shipping address
        </h2>
        <p className="text-small text-secondary">Where should we deliver your order?</p>
      </div>
    </div>

    <div className="grid gap-4 xs:grid-cols-2">
      <TextField
        label="First name"
        autoComplete="given-name"
        placeholder="Priya"
        error={errors.firstName?.message}
        {...register('firstName')}
      />

      <TextField
        label="Last name"
        autoComplete="family-name"
        placeholder="Sharma"
        error={errors.lastName?.message}
        {...register('lastName')}
      />

      <TextField
        label="Phone number"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="9876543210"
        hint="We'll call before delivery"
        error={errors.phone?.message}
        {...register('phone')}
      />

      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="priya@example.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <div className="xs:col-span-2">
        <TextField
          label="Address"
          autoComplete="street-address"
          placeholder="House number, building, street, area"
          error={errors.address?.message}
          {...register('address')}
        />
      </div>

      <div className="xs:col-span-2">
        <TextField
          label="Landmark"
          optional
          placeholder="Near the metro station"
          error={errors.landmark?.message}
          {...register('landmark')}
        />
      </div>

      <TextField
        label="City"
        autoComplete="address-level2"
        placeholder="Bengaluru"
        error={errors.city?.message}
        {...register('city')}
      />

      <TextField
        label="State"
        autoComplete="address-level1"
        placeholder="Karnataka"
        error={errors.state?.message}
        {...register('state')}
      />

      <TextField
        label="PIN code"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="560001"
        error={errors.pincode?.message}
        {...register('pincode')}
      />
    </div>
  </section>
);
