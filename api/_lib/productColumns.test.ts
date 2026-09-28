import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Guards the storefront column lists that feed the cart and checkout summaries.
 *
 * Each service selects an explicit, deliberately narrow set of columns. Dropping
 * `shipping_exempt` from one does not fail the build: those queries are typed
 * with `overrideTypes<Product[]>()`, which asserts the shape rather than
 * deriving it from the select. The field would simply arrive `undefined`, every
 * line would read as non-exempt, and the checkout page would quote ₹79 of
 * shipping that `priceOrder` does not charge — the frontend/backend mismatch
 * this project works hardest to avoid.
 *
 * It lives under `api/` rather than `src/` because it reads files from disk and
 * the storefront tsconfig deliberately excludes node types.
 */

const SERVICES = [
  'src/services/cartValidation.ts', // cart + checkout summaries
  'src/services/products.ts',
  'src/services/shop.ts',
  'src/services/productDetail.ts',
];

describe('storefront product column lists', () => {
  it.each(SERVICES)('%s selects shipping_exempt', (file) => {
    expect(readFileSync(file, 'utf8')).toContain('shipping_exempt');
  });
});
