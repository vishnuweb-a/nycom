import { describe, expect, it } from 'vitest';

import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/commerce';
import type { CartItem, ReconciledLine } from '@/types/cart';
import { calculateOrderSummary } from '@/utils/cart';

/**
 * Storefront shipping display.
 *
 * `api/_lib/pricing.ts` is authoritative for what is actually charged; these
 * figures are what the shopper is shown. The two must agree, or the cart
 * quotes one total and the card is debited another — so these cases mirror
 * the exemption cases in `pricing.test.ts` one for one.
 */

const line = (item: Partial<CartItem>, purchasable = true): ReconciledLine => ({
  item: {
    productId: 'p1',
    slug: 'p1',
    title: 'Product',
    thumbnail: '',
    brand: 'Yarnvia',
    selectedSize: 'Free Size',
    quantity: 1,
    unitPrice: 1,
    discountPrice: 1,
    stock: 100,
    ...item,
  },
  issues: [],
  purchasable,
});

describe('calculateOrderSummary shipping', () => {
  it('charges the fee on a normal basket below the threshold', () => {
    const summary = calculateOrderSummary([line({ shippingExempt: false })]);

    expect(summary.subtotal).toBe(1);
    expect(summary.shipping).toBe(SHIPPING_FEE);
    expect(summary.grandTotal).toBe(80);
  });

  it('waives the fee for a wholly exempt basket', () => {
    const summary = calculateOrderSummary([line({ shippingExempt: true })]);

    expect(summary.subtotal).toBe(1);
    expect(summary.shipping).toBe(0);
    expect(summary.grandTotal).toBe(1);
  });

  it('shows no free-shipping shortfall for an exempt basket', () => {
    // Otherwise the panel nudges "add ₹998 more for free shipping" beside a
    // basket that already ships free.
    expect(calculateOrderSummary([line({ shippingExempt: true })]).freeShippingShortfall).toBe(0);
  });

  it('keeps the threshold rule for normal baskets', () => {
    const summary = calculateOrderSummary([
      line({ unitPrice: 1200, discountPrice: 1200, shippingExempt: false }),
    ]);

    expect(1200).toBeGreaterThanOrEqual(FREE_SHIPPING_THRESHOLD);
    expect(summary.shipping).toBe(0);
  });

  it('still charges shipping on a mixed basket below the threshold', () => {
    const summary = calculateOrderSummary([
      line({ shippingExempt: true }),
      line({ productId: 'p2', unitPrice: 500, discountPrice: 500, shippingExempt: false }),
    ]);

    expect(summary.subtotal).toBe(501);
    expect(summary.shipping).toBe(SHIPPING_FEE);
    expect(summary.grandTotal).toBe(580);
  });

  it('waives the fee across several exempt lines', () => {
    const summary = calculateOrderSummary([
      line({ shippingExempt: true }),
      line({ productId: 'p2', shippingExempt: true }),
    ]);

    expect(summary.subtotal).toBe(2);
    expect(summary.shipping).toBe(0);
  });

  it('treats a line persisted before the field existed as non-exempt', () => {
    // An old localStorage cart has no `shippingExempt` at all.
    expect(calculateOrderSummary([line({})]).shipping).toBe(SHIPPING_FEE);
  });

  it('charges nothing for an empty basket', () => {
    // `[].every(...)` is vacuously true, so this must not be mistaken for an
    // exempt basket — and must not produce a payable total either.
    const summary = calculateOrderSummary([]);

    expect(summary.shipping).toBe(0);
    expect(summary.grandTotal).toBe(0);
  });

  it('ignores unpurchasable lines when deciding the exemption', () => {
    // An unavailable normal line must not drag shipping onto a basket whose
    // payable contents are entirely exempt.
    const summary = calculateOrderSummary([
      line({ shippingExempt: true }),
      line({ productId: 'p2', unitPrice: 500, discountPrice: 500, shippingExempt: false }, false),
    ]);

    expect(summary.subtotal).toBe(1);
    expect(summary.shipping).toBe(0);
  });
});
