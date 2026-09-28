import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Creates the ₹1 shipping-exempt payment-testing product.
 *
 * Run with:  npm run seed:test-product
 *
 * This exists so a real Airpay transaction can be exercised end to end for a
 * small, predictable amount. It writes one ordinary catalogue row — nothing
 * about the payment path is special-cased — and the ₹1 the gateway is asked
 * for is read back out of this row by `priceOrder()` like any other price.
 *
 * `shipping_exempt` is what keeps the charge at ₹1 rather than ₹80. Requires
 * `supabase/migrations/0004_shipping_exempt.sql` to have been applied.
 *
 * Idempotent: the upload uses a deterministic `public_id` with `overwrite`, and
 * the product upserts on `slug`, so re-running updates in place. It touches
 * only its own row — no category cover, carousel or existing listing is
 * altered, including the earlier `yarnvia-test-product` row, which keeps its
 * own price and is left entirely alone.
 */

const CLOUDINARY_FOLDER = 'yarnvia/products/test';
const IMAGE_DIR = path.join(process.cwd(), 'assets', 'test-product');
const IMAGE_FILE = 'yarnvia-test-product.png';
const SLUG = 'yarnvia-1-rupee-test-product';

const CLOUD = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

for (const [name, value] of Object.entries({
  VITE_CLOUDINARY_CLOUD_NAME: CLOUD,
  CLOUDINARY_API_KEY: API_KEY,
  CLOUDINARY_API_SECRET: API_SECRET,
  VITE_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE: SERVICE_ROLE,
})) {
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
}

const supabaseHeaders = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

const sign = (params) =>
  createHash('sha1')
    .update(
      Object.keys(params)
        .sort()
        .map((key) => `${key}=${String(params[key])}`)
        .join('&') + API_SECRET,
    )
    .digest('hex');

/** Uploads the placeholder, overwriting any asset already at that public_id. */
const uploadImage = async (dir, filename, publicId) => {
  const timestamp = Math.floor(Date.now() / 1000);

  const form = new FormData();
  form.append('file', new Blob([readFileSync(path.join(dir, filename))]), filename);
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('overwrite', 'true');
  form.append('signature', sign({ overwrite: 'true', public_id: publicId, timestamp }));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed for ${filename}: ${JSON.stringify(body)}`);
  }

  return {
    secure_url: body.secure_url,
    public_id: body.public_id,
    width: body.width,
    height: body.height,
  };
};

const main = async () => {
  // Fail early and clearly if the migration has not been applied, rather than
  // letting PostgREST reject the insert with a column-not-found error.
  const probe = await fetch(`${SUPABASE_URL}/rest/v1/products?select=shipping_exempt&limit=1`, {
    headers: supabaseHeaders,
  });

  if (!probe.ok) {
    console.error(
      '\nCould not read `products.shipping_exempt`.\n' +
        'Apply supabase/migrations/0004_shipping_exempt.sql in the Supabase SQL Editor first.\n' +
        `(${String(probe.status)}: ${await probe.text()})\n`,
    );
    process.exit(1);
  }

  const asset = {
    ...(await uploadImage(IMAGE_DIR, IMAGE_FILE, `${CLOUDINARY_FOLDER}/${SLUG}`)),
    alt: 'Yarnvia ₹1 Test Product — neutral placeholder',
  };

  console.log(`Uploaded ${asset.public_id}`);

  const row = {
    title: 'Yarnvia ₹1 Test Product',
    subtitle: 'Internal payment testing',
    ribbon: null,
    description:
      'Internal payment-testing listing used to verify the live checkout and Airpay ' +
      'settlement path with a small, predictable amount. Not a retail product.',
    images: [asset],
    thumbnail: asset,

    // The figure the gateway is ultimately asked for. `discount_price` equals
    // `price` so the card shows a flat ₹1 with no struck-through original.
    price: 1,
    discount_price: 1,
    sku: 'YV-TEST-00001',
    weight_grams: 0,
    track_quantity: true,

    category: 'women',
    gender: 'Women',
    brand: 'Yarnvia',
    collection: null,
    season: null,
    material: null,
    occasion: null,

    // Deep stock so the listing survives repeated test purchases.
    variants: [{ size: 'Free Size', color: 'Natural', quantity: 100, stock: 'in_stock' }],

    rating: 0,
    review_count: 0,

    // No display flag is set, so it never surfaces on a homepage rail. It is
    // reachable by direct link and through Shop, which is all testing needs.
    featured: false,
    top_selling: false,
    new_arrival: false,
    trending: false,
    active: true,

    // The one field that makes this ₹1 rather than ₹80 at checkout.
    shipping_exempt: true,

    slug: SLUG,
    meta_title: 'Yarnvia ₹1 Test Product',
    meta_description: 'Internal payment-testing listing.',
    tags: ['test', 'internal'],
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=slug`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase products write failed (${String(response.status)}): ${await response.text()}`,
    );
  }

  const [created] = await response.json();

  console.log('\nUpserted the test product.\n');
  console.log(`  id              ${created.id}`);
  console.log(`  slug            ${created.slug}`);
  console.log(`  price           ${String(created.price)}`);
  console.log(`  discount_price  ${String(created.discount_price)}`);
  console.log(`  shipping_exempt ${String(created.shipping_exempt)}`);
  console.log(`  variant         Free Size × ${String(created.variants[0].quantity)}`);
  console.log(`\n  /product/${created.slug}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
