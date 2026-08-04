/**
 * Display formatting helpers.
 *
 * Locale and currency live here so a future multi-currency storefront changes
 * one module rather than every price on the site.
 */

const LOCALE = 'en-IN';
const CURRENCY = 'INR';

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat(LOCALE, { notation: 'compact' });

/** `1499` → `₹1,499` */
export const formatPrice = (amount: number): string => currencyFormatter.format(amount);

/** `4.5` → `4.5`, `4` → `4.0` — ratings always show one decimal. */
export const formatRating = (rating: number): string => rating.toFixed(1);

/** `1240` → `1.2K`, used for review counts on compact cards. */
export const formatCount = (count: number): string => compactFormatter.format(count);
