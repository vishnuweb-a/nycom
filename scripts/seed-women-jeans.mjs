import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { readWomenJeans } from './women-jeans.mjs';

/**
 * Uploads the women's denim photography to Cloudinary and upserts the listings.
 *
 * Run with:  npm run seed:women-jeans
 *
 * Kept separate from `seed.mjs` because this range carries several photographs
 * per garment and a fixed price, neither of which the filename-derived
 * catalogue models. Idempotent for the same reasons: uploads use a
 * deterministic `public_id` with `overwrite`, and products upsert on `slug`.
 *
 * It touches only its own rows — the existing catalogue, category covers and
 * carousel are left exactly as `seed.mjs` left them.
 */

const CLOUDINARY_FOLDER = 'yarnvia/products/women-jeans';

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

/** Uploads one file, overwriting any asset already at that public_id. */
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

/** Sends rows to PostgREST with the service role, which bypasses RLS. */
const postRows = async (table, rows, onConflict) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase ${table} write failed (${String(response.status)}): ${await response.text()}`,
    );
  }
};

const main = async () => {
  const catalog = readWomenJeans();
  const total = catalog.reduce((sum, product) => sum + product.shots.length, 0);

  console.log(`Parsed ${String(catalog.length)} products across ${String(total)} photographs.`);

  const rows = [];
  let uploaded = 0;

  for (const product of catalog) {
    const images = [];

    for (const shot of product.shots) {
      const image = await uploadImage(
        product.sourceDir,
        shot.file,
        `${CLOUDINARY_FOLDER}/${shot.key}`,
      );

      images.push({ ...image, alt: product.alt });
      uploaded += 1;
      console.log(`  [${String(uploaded).padStart(2)}/${String(total)}] ${shot.key}`);
    }

    rows.push({
      title: product.title,
      subtitle: product.subtitle,
      ribbon: product.ribbon,
      description: product.description,
      images,
      // The hero shot leads `shots`, so index 0 is the thumbnail.
      thumbnail: images[0],

      price: product.price,
      discount_price: product.discountPrice,
      sku: product.sku,
      weight_grams: product.weightGrams,
      track_quantity: true,

      category: product.category,
      gender: product.gender,
      brand: product.brand,
      collection: product.collection,
      season: product.season,
      material: product.material,
      occasion: product.occasion,

      variants: product.variants,
      rating: product.rating,
      review_count: product.reviewCount,

      featured: product.featured,
      top_selling: product.topSelling,
      new_arrival: product.newArrival,
      trending: product.trending,
      active: true,

      slug: product.slug,
      meta_title: product.metaTitle,
      meta_description: product.metaDescription,
      tags: product.tags,
    });
  }

  await postRows('products', rows, 'slug');
  console.log(`Upserted ${String(rows.length)} women's jeans products.`);
};

await main();
