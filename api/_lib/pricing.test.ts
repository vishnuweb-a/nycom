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

/** The shipping-exempt test product: ₹1, free size, deep stock. */
const PRODUCT_EXEMPT = {
  id: '44444444-4444-4444-8444-444444444444',
  slug: 'yarnvia-test-product',
  title: 'Yarnvia ₹1 Test Product',
  brand: 'Yarnvia',
  price: 1,
  discount_price: 1,
  images: [{ secure_url: 'https://res.cloudinary.com/x/test.jpg' }],
  thumbnail: { secure_url: 'https://res.cloudinary.com/x/test.jpg' },
  variants: [{ size: 'Free Size', color: 'Natural', quantity: 100, stock: 'in_stock' }],
  shipping_exempt: true,
};

/** A second exempt row, so "every line exempt" can be tested across two lines. */
const PRODUCT_EXEMPT_B = {
  ...PRODUCT_EXEMPT,
  id: '55555555-5555-4555-8555-555555555555',
  slug: 'yarnvia-test-product-b',
};

/** A normal ₹500 product, for the mixed-basket case. */
const PRODUCT_NORMAL_500 = {
  id: '66666666-6666-4666-8666-666666666666',
  slug: 'normal-five-hundred',
  title: 'Normal Product',
  brand: 'Yarnvia',
  price: 500,
  discount_price: null,
  images: [],
  thumbnail: null,
  variants: [{ size: 'M', color: 'blue', quantity: 10, stock: 'in_stock' }],
  shipping_exempt: false,
};

/** A normal ₹1 product — the regression guard for case 1. */
const PRODUCT_NORMAL_1 = {
  id: '77777777-7777-4777-8777-777777777777',
  slug: 'normal-one-rupee',
  title: 'Normal Cheap Product',
  brand: 'Yarnvia',
  price: 1,
  discount_price: null,
  images: [],
  thumbnail: null,
  variants: [{ size: 'Free Size', color: 'Natural', quantity: 50, stock: 'in_stock' }],
  shipping_exempt: false,
};

let catalogue: unknown[] = [];
let queryError: { message: string } | null = null;

vi.mock('./db.js', () => ({
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
  catalogue = [
    PRODUCT_A,
    PRODUCT_B,
    PRODUCT_EXEMPT,
    PRODUCT_EXEMPT_B,
    PRODUCT_NORMAL_500,
    PRODUCT_NORMAL_1,
  ];
  queryError = null;
});

const pricing = async () => import('./pricing.js');

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

/*
 * The guard that makes restating the shipping rules in `pricing.ts` safe.
 *
 * The server cannot import `src/constants/commerce.ts` at runtime — see the
 * comment there — so the numbers are duplicated. A test can import both, and
 * this is where drift is caught: if anyone changes the storefront's shipping
 * threshold or fee without changing the server's, the suite fails here instead
 * of the shop quoting one total and charging another.
 */
describe('shipping rules match the storefront', () => {
  it('charges exactly what src/constants/commerce.ts quotes', async () => {
    const { priceOrder } = await pricing();
    const { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } =
      await import('../../src/constants/commerce.js');

    // One unit of PRODUCT_B is 499 — below any sane threshold, so shipping applies.
    const below = await priceOrder([{ productId: PRODUCT_B.id, size: 'L', quantity: 1 }]);

    expect(below.shipping).toBe(SHIPPING_FEE);

    // Prove the threshold itself agrees, by pricing a basket that just clears it.
    const unitsToClear = Math.ceil(FREE_SHIPPING_THRESHOLD / 499);
    const above = await priceOrder([
      { productId: PRODUCT_B.id, size: 'L', quantity: unitsToClear },
    ]);

    expect(499 * unitsToClear).toBeGreaterThanOrEqual(FREE_SHIPPING_THRESHOLD);
    expect(above.shipping).toBe(0);
  });
});

/*
 * Product-level shipping exemption.
 *
 * The rule is unanimous, not contagious: a basket ships free below the
 * threshold only when every line is exempt. These cases pin both halves of
 * that — the exemption working, and it failing to leak to normal goods.
 */
describe('shipping exemption', () => {
  it('charges shipping on a normal product below the threshold', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([
      { productId: PRODUCT_NORMAL_1.id, size: 'Free Size', quantity: 1 },
    ]);

    expect(result.subtotal).toBe(1);
    expect(result.shipping).toBe(79);
    expect(result.grandTotal).toBe(80);
  });

  it('waives shipping for a wholly exempt basket below the threshold', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([
      { productId: PRODUCT_EXEMPT.id, size: 'Free Size', quantity: 1 },
    ]);

    expect(result.subtotal).toBe(1);
    expect(result.shipping).toBe(0);
    expect(result.grandTotal).toBe(1);
  });

  it('leaves the threshold rule alone for normal baskets at or above it', async () => {
    const { priceOrder } = await pricing();

    // 500 × 3 = 1500, clearing 999 the ordinary way.
    const result = await priceOrder([{ productId: PRODUCT_NORMAL_500.id, size: 'M', quantity: 3 }]);

    expect(result.shipping).toBe(0);
    expect(result.grandTotal).toBe(1500);
  });

  /*
   * The anti-exploit case. If this ever reports ₹0 shipping, the exempt
   * product has become a free-delivery voucher for the whole catalogue.
   */
  it('still charges shipping when an exempt item is mixed with a normal one', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([
      { productId: PRODUCT_EXEMPT.id, size: 'Free Size', quantity: 1 },
      { productId: PRODUCT_NORMAL_500.id, size: 'M', quantity: 1 },
    ]);

    expect(result.subtotal).toBe(501);
    expect(result.shipping).toBe(79);
    expect(result.grandTotal).toBe(580);
  });

  it('waives shipping across several exempt lines', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([
      { productId: PRODUCT_EXEMPT.id, size: 'Free Size', quantity: 1 },
      { productId: PRODUCT_EXEMPT_B.id, size: 'Free Size', quantity: 1 },
    ]);

    expect(result.subtotal).toBe(2);
    expect(result.shipping).toBe(0);
    expect(result.grandTotal).toBe(2);
  });

  it('waives shipping for several units of one exempt product', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([
      { productId: PRODUCT_EXEMPT.id, size: 'Free Size', quantity: 2 },
    ]);

    expect(result.shipping).toBe(0);
    expect(result.grandTotal).toBe(2);
  });

  it('leaves the empty-basket rejection unchanged', async () => {
    const { priceOrder } = await pricing();

    // Guards the vacuous-truth trap: `[].every(...)` is true, so an empty
    // basket must be rejected before the exemption is ever consulted.
    await expect(priceOrder([])).rejects.toThrow(/empty/i);
  });

  it('treats a product with no shipping_exempt column as non-exempt', async () => {
    const { priceOrder } = await pricing();

    // PRODUCT_B carries no such key at all, as a pre-migration row would not.
    const result = await priceOrder([{ productId: PRODUCT_B.id, size: 'L', quantity: 1 }]);

    expect(result.shipping).toBe(79);
  });

  it('reports the exemption on the priced line from the catalogue', async () => {
    const { priceOrder } = await pricing();

    const result = await priceOrder([
      { productId: PRODUCT_EXEMPT.id, size: 'Free Size', quantity: 1 },
      { productId: PRODUCT_NORMAL_500.id, size: 'M', quantity: 1 },
    ]);

    expect(result.items[0]?.shippingExempt).toBe(true);
    expect(result.items[1]?.shippingExempt).toBe(false);
  });

  /*
   * The security assertion, matching the one guarding price above. The
   * exemption is a catalogue fact; a client claiming it changes nothing,
   * because `priceOrder` reads the column and never the request.
   */
  it('ignores a shipping exemption the client tries to claim', async () => {
    const { priceOrder } = await pricing();

    const tampered = await priceOrder([
      {
        productId: PRODUCT_NORMAL_1.id,
        size: 'Free Size',
        quantity: 1,
        shipping_exempt: true,
        shippingExempt: true,
        shipping: 0,
      } as never,
    ]);

    expect(tampered.shipping).toBe(79);
    expect(tampered.grandTotal).toBe(80);
    expect(tampered.items[0]?.shippingExempt).toBe(false);
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
