import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Amount-validation tests — the control that stops a shopper paying ₹1 for a
 * ₹5,000 basket.
 *
 * The catalogue is stubbed so these run offline. What they assert is not that
 * the arithmetic is right (though it is checked) but that the *client has no
 * influence over it*: the request type has nowhere to state a price, and the
 * totals come only from the stubbed product rows.
 */

const PRODUCT_A = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'silk-saree',
  title: 'Silk Saree',
  brand: 'Yarnvia',
  price: 2500,
  discount_price: 1999,
  images: [{ secure_url: 'https://res.cloudinary.com/x/a.jpg' }],
  thumbnail: { secure_url: 'https://res.cloudinary.com/x/thumb.jpg' },
  variants: [
    { size: 'M', color: 'red', quantity: 5, stock: 'in_stock' },
    { size: 'S', color: 'red', quantity: 0, stock: 'out_of_stock' },
  ],
};

const PRODUCT_B = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'cotton-tee',
  title: 'Cotton Tee',
  brand: 'Yarnvia',
  price: 499,
  discount_price: null,
  images: [],
  thumbnail: null,
  variants: [{ size: 'L', color: 'white', quantity: 3, stock: 'in_stock' }],
};

let catalogue: unknown[] = [];
let queryError: { message: string } | null = null;

vi.mock('./db', () => ({
  db: () => ({
    from: () => ({
      select: () => ({
        in: () => ({
          eq: () => Promise.resolve({ data: catalogue, error: queryError }),
        }),
      }),
    }),
  }),
}));

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE = 'test-service-role';
  catalogue = [PRODUCT_A, PRODUCT_B];
  queryError = null;
});

const pricing = async () => import('./pricing');

describe('priceOrder', () => {
  it('prices from the catalogue, using discount_price when present', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([{ productId: PRODUCT_A.id, size: 'M', quantity: 2 }]);

    expect(result.subtotal).toBe(5000); // 2500 × 2, the struck-through figure
    expect(result.savings).toBe(1002); // (2500 − 1999) × 2
    expect(result.shipping).toBe(0); // 3998 ≥ the free-shipping threshold
    expect(result.grandTotal).toBe(3998); // 1999 × 2
  });

  it('falls back to price when discount_price is null', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([{ productId: PRODUCT_B.id, size: 'L', quantity: 1 }]);

    expect(result.savings).toBe(0);
    expect(result.grandTotal).toBe(499 + 79); // below the threshold, so shipping applies
  });

  it('applies the shipping fee below the free-shipping threshold', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([{ productId: PRODUCT_B.id, size: 'L', quantity: 1 }]);

    expect(result.shipping).toBe(79);
  });

  it('waives shipping at or above the threshold', async () => {
    const { priceOrder } = await pricing();

    // 499 × 3 = 1497, clearing the 999 threshold. Two units would be 998 — one
    // rupee short — so this boundary is worth stating explicitly.
    const result = await priceOrder([{ productId: PRODUCT_B.id, size: 'L', quantity: 3 }]);

    expect(result.grandTotal).toBe(1497);
    expect(result.shipping).toBe(0);

    const justUnder = await priceOrder([{ productId: PRODUCT_B.id, size: 'L', quantity: 2 }]);

    expect(justUnder.shipping).toBe(79);
    expect(justUnder.grandTotal).toBe(1077);
  });

  /*
   * The core assertion. Extra client-supplied money fields are not merely
   * ignored by policy — there is no parameter for them, so a caller cannot
   * express a price at all. Passing them changes nothing.
   */
  it('ignores any price the client tries to smuggle in', async () => {
    const { priceOrder } = await pricing();

    const honest = await priceOrder([{ productId: PRODUCT_A.id, size: 'M', quantity: 1 }]);

    const tampered = await priceOrder([
      {
        productId: PRODUCT_A.id,
        size: 'M',
        quantity: 1,
        // Every shape an attacker might try, all inert.
        unitPrice: 1,
        discountPrice: 1,
        price: 1,
        amount: 1,
        grandTotal: 1,
        shipping: -500,
      } as never,
    ]);

    expect(tampered.grandTotal).toBe(honest.grandTotal);
    expect(tampered.grandTotal).toBe(1999);
  });

  it('sums a multi-line basket from catalogue prices only', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([
      { productId: PRODUCT_A.id, size: 'M', quantity: 1 },
      { productId: PRODUCT_B.id, size: 'L', quantity: 2 },
    ]);

    expect(result.grandTotal).toBe(1999 + 998);
  });

  it('rejects a quantity beyond available stock', async () => {
    const { priceOrder } = await pricing();

    await expect(priceOrder([{ productId: PRODUCT_A.id, size: 'M', quantity: 6 }])).rejects.toThrow(
      /out of stock/i,
    );
  });

  it('rejects an out-of-stock variant', async () => {
    const { priceOrder } = await pricing();

    await expect(priceOrder([{ productId: PRODUCT_A.id, size: 'S', quantity: 1 }])).rejects.toThrow(
      /out of stock/i,
    );
  });

  it('rejects a size that does not exist', async () => {
    const { priceOrder } = await pricing();

    await expect(
      priceOrder([{ productId: PRODUCT_A.id, size: 'XXL', quantity: 1 }]),
    ).rejects.toThrow(/out of stock/i);
  });

  it('rejects an unknown or deactivated product', async () => {
    const { priceOrder } = await pricing();

    await expect(
      priceOrder([{ productId: '33333333-3333-4333-8333-333333333333', size: 'M', quantity: 1 }]),
    ).rejects.toThrow(/no longer available/i);
  });

  it('rejects an empty basket', async () => {
    const { priceOrder } = await pricing();

    await expect(priceOrder([])).rejects.toThrow(/empty/i);
  });

  it('rejects a zero or negative quantity', async () => {
    const { priceOrder } = await pricing();

    await expect(priceOrder([{ productId: PRODUCT_A.id, size: 'M', quantity: 0 }])).rejects.toThrow(
      /quantities/i,
    );

    await expect(
      priceOrder([{ productId: PRODUCT_A.id, size: 'M', quantity: -3 }]),
    ).rejects.toThrow(/quantities/i);
  });

  it('rejects an oversized basket rather than querying for it', async () => {
    const { priceOrder } = await pricing();

    const lines = Array.from({ length: 51 }, () => ({
      productId: PRODUCT_A.id,
      size: 'M',
      quantity: 1,
    }));

    await expect(priceOrder(lines)).rejects.toThrow(/too many items/i);
  });
});

describe('generateOrderRef', () => {
  it('matches the YV- reference format', async () => {
    const { generateOrderRef } = await pricing();

    expect(generateOrderRef()).toMatch(/^YV-[0-9A-Z]{1,5}-[0-9A-F]{8}$/);
  });

  it('does not repeat across a large sample', async () => {
    const { generateOrderRef } = await pricing();

    const refs = new Set(Array.from({ length: 5000 }, () => generateOrderRef()));

    expect(refs.size).toBe(5000);
  });
});

describe('formatAmount', () => {
  it('always renders two decimal places', async () => {
    const { formatAmount } = await pricing();

    expect(formatAmount(1499)).toBe('1499.00');
    expect(formatAmount(1499.5)).toBe('1499.50');
    expect(formatAmount(0.1 + 0.2)).toBe('0.30');
  });
});
