import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { readWomenShortsSkirts } from './women-shorts-skirts.mjs';

/**
 * Uploads the women's shorts and skirts photography to Cloudinary and upserts
 * the listings.
 *
 * Run with:  npm run seed:women-shorts-skirts
 *
 * A near-copy of `seed-women-jeans.mjs`, kept separate for the same reasons:
 * this range carries several photographs per garment and a fixed price, and it
 * writes to its own Cloudinary folder. Idempotent — uploads use a
 * deterministic `public_id` with `overwrite`, and products upsert on `slug`.
 *
 * It touches only its own rows — the existing catalogue, category covers and
 * carousel are left exactly as `seed.mjs` left them.
 */

const CLOUDINARY_FOLDER = 'yarnvia/products/women-shorts-skirts';

/** How many times one upload is attempted before the run gives up. */
const UPLOAD_ATTEMPTS = 4;

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

/**
 * Uploads one file, overwriting any asset already at that public_id.
 *
 * Retried on transport failure: a 150-image run over a home connection drops
 * the odd socket, and without this one `ECONNRESET` aborts the whole seed.
 * Safe to repeat because the `public_id` is deterministic and overwritten.
 */
const uploadImage = async (dir, filename, publicId, attempt = 1) => {
  const timestamp = Math.floor(Date.now() / 1000);

  const form = new FormData();
  form.append('file', new Blob([readFileSync(path.join(dir, filename))]), filename);
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('overwrite', 'true');
  form.append('signature', sign({ overwrite: 'true', public_id: publicId, timestamp }));

  let response;

  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    if (attempt >= UPLOAD_ATTEMPTS) {
      throw error;
    }

    // Linear back-off: a few seconds is enough for a dropped socket.
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));

    return uploadImage(dir, filename, publicId, attempt + 1);
  }

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
  const catalog = readWomenShortsSkirts();
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
  console.log(`Upserted ${String(rows.length)} women's shorts and skirts products.`);
};

await main();
