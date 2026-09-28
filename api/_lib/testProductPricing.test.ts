import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * End-to-end pricing check for the ₹1 shipping-exempt testing product.
 *
 * `pricing.test.ts` covers the exemption rule in general; this pins the one
 * concrete outcome the payment test depends on — that this specific row,
 * exactly as `scripts/seed-test-product.mjs` writes it, produces the string
 * `1.00` in the Airpay payload rather than `80.00`.
 *
 * `formatAmount` is the real one used by `api/payments/create.ts`; only the
 * catalogue lookup is stubbed, so the arithmetic under test is production code.
 */

/** A verbatim copy of the row the seed script upserts. */
const TEST_PRODUCT = {
  id: '99999999-9999-4999-8999-999999999999',
  slug: 'yarnvia-test-product',
  title: 'Yarnvia ₹1 Test Product',
  brand: 'Yarnvia',
  price: 1,
  discount_price: 1,
  images: [{ secure_url: 'https://res.cloudinary.com/x/test.png' }],
  thumbnail: { secure_url: 'https://res.cloudinary.com/x/test.png' },
  variants: [{ size: 'Free Size', color: 'Natural', quantity: 100, stock: 'in_stock' }],
  shipping_exempt: true,
};

vi.mock('./db.js', () => ({
  db: () => ({
    from: () => ({
      select: () => ({
        in: () => ({ eq: () => Promise.resolve({ data: [TEST_PRODUCT], error: null }) }),
      }),
    }),
  }),
}));

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE = 'test-service-role';
});

describe('the ₹1 test product', () => {
  it('prices to ₹1 with no shipping', async () => {
    const { priceOrder } = await import('./pricing.js');

    const result = await priceOrder([
      { productId: TEST_PRODUCT.id, size: 'Free Size', quantity: 1 },
    ]);

    expect(result.subtotal).toBe(1);
    expect(result.savings).toBe(0);
    expect(result.shipping).toBe(0);
    expect(result.grandTotal).toBe(1);
  });

  it('sends Airpay exactly 1.00', async () => {
    const { priceOrder, formatAmount } = await import('./pricing.js');

    const result = await priceOrder([
      { productId: TEST_PRODUCT.id, size: 'Free Size', quantity: 1 },
    ]);

    // The very string `api/payments/create.ts` puts in the encrypted payload.
    expect(formatAmount(result.grandTotal)).toBe('1.00');
  });

  it('still prices to ₹1 when the client claims otherwise', async () => {
    const { priceOrder, formatAmount } = await import('./pricing.js');

    const result = await priceOrder([
      {
        productId: TEST_PRODUCT.id,
        size: 'Free Size',
        quantity: 1,
        price: 9999,
        amount: 9999,
        grandTotal: 9999,
        shipping_exempt: false,
      } as never,
    ]);

    expect(formatAmount(result.grandTotal)).toBe('1.00');
  });
});
