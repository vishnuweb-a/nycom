/**
 * Commercial policy shown to shoppers.
 *
 * These are business rules, not design tokens — a change to the returns window
 * or the free-shipping threshold must alter every surface that quotes it, so
 * they live here rather than being typed into copy.
 *
 * Cash on Delivery is the only payment method this MVP supports.
 */

/** Working days from dispatch to delivery, used for the estimated date. */
export const DELIVERY_DAYS = { min: 3, max: 6 } as const;

/** Days a shopper has to return an unworn item. */
export const RETURN_WINDOW_DAYS = 7;

/** Orders at or above this value ship free. */
export const FREE_SHIPPING_THRESHOLD = 999;

/** Flat shipping charge below the threshold. */
export const SHIPPING_FEE = 79;

/** Displayed beside the price. Catalogue prices are tax inclusive. */
export const GST_NOTE = 'Inclusive of all taxes';

/**
 * Formats the estimated delivery window as a readable date range,
 * e.g. "Mon, 8 Aug – Thu, 11 Aug".
 */
export const estimatedDeliveryRange = (from: Date = new Date()): string => {
  const format = (days: number) => {
    const date = new Date(from);
    date.setDate(date.getDate() + days);

    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return `${format(DELIVERY_DAYS.min)} – ${format(DELIVERY_DAYS.max)}`;
};
