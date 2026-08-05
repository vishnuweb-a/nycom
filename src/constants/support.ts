import type { BrandName } from '@/components/common/BrandIcon';

/**
 * Customer-facing support channels.
 *
 * Deliberately separate from `COMPANY` in `constants/company.ts`: that file
 * holds the *registered* entity — the legal name, filed address and the numbers
 * on record — which the footer and the policy pages must state verbatim. These
 * are the channels a shopper is invited to use, which a business routinely
 * routes elsewhere (a support desk rather than the registered office line).
 *
 * If the two should be the same, delete this file and read `COMPANY` instead.
 */

export const SUPPORT = {
  email: 'support@yarnvia.com',
  /** As displayed. */
  phone: '+91 98765 43210',
  /** E.164, for the `tel:` link. */
  phoneE164: '+919876543210',
  office: 'New Delhi, India',
  hours: {
    days: 'Monday – Saturday',
    time: '9:00 AM – 7:00 PM',
  },
} as const;

export interface SocialProfile {
  readonly brand: BrandName;
  readonly label: string;
  readonly href: string;
}

/**
 * Social profiles shown on the Contact page.
 *
 * The hrefs are platform home pages until the real handles are supplied — the
 * same placeholder convention `SOCIAL_LINKS` in `constants/navigation.ts`
 * already uses for the footer.
 */
export const SOCIAL_PROFILES: readonly SocialProfile[] = [
  { brand: 'instagram', label: 'Instagram', href: 'https://instagram.com' },
  { brand: 'facebook', label: 'Facebook', href: 'https://facebook.com' },
  { brand: 'x', label: 'X', href: 'https://x.com' },
  { brand: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com' },
];
