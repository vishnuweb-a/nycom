import { z } from 'zod';

/**
 * Shipping address validation.
 *
 * Rules are deliberately India-specific because the storefront prices in INR
 * and delivers domestically: a 10-digit mobile beginning 6–9, and a 6-digit
 * PIN code that cannot start with zero.
 *
 * Validation is client-side only — this MVP has no order backend — so these
 * rules exist to give honest, immediate feedback, not to secure anything.
 */
export const addressSchema = z.object({
  firstName: z.string().trim().min(2, 'Enter your first name').max(50, 'First name is too long'),
  lastName: z.string().trim().min(1, 'Enter your last name').max(50, 'Last name is too long'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  address: z
    .string()
    .trim()
    .min(10, 'Enter your full address, including house and street')
    .max(200, 'Address is too long'),
  landmark: z.string().trim().max(100, 'Landmark is too long'),
  city: z.string().trim().min(2, 'Enter your city'),
  state: z.string().trim().min(2, 'Enter your state'),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

export const EMPTY_ADDRESS: AddressFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  address: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
};
