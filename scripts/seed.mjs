import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { readCatalog, SOURCE_DIR } from './catalog.mjs';

/**
 * Uploads the source photography to Cloudinary and seeds Supabase with the
 * derived catalogue.
 *
 * Run with:  npm run seed
 *
 * Idempotent. Cloudinary uploads use a deterministic `public_id` with
 * `overwrite`, and products upsert on `slug`, so re-running updates in place
 * rather than duplicating. Requires `supabase/migrations/0001_init.sql` to have
 * been applied first.
 */

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

const sign = (params) => {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&');

  return createHash('sha1')
    .update(canonical + API_SECRET)
    .digest('hex');
};

/** Uploads one file, overwriting any asset already at that public_id. */
const uploadImage = async (filename, publicId) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { overwrite: 'true', public_id: publicId, timestamp };

  const form = new FormData();
  form.append('file', new Blob([readFileSync(path.join(SOURCE_DIR, filename))]), filename);
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('overwrite', 'true');
  form.append('signature', sign(params));

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
const postRows = async (table, rows, { onConflict } = {}) => {
  const query = onConflict === undefined ? '' : `?on_conflict=${onConflict}`;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer:
        onConflict === undefined ? 'return=minimal' : 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase ${table} write failed (${String(response.status)}): ${await response.text()}`,
    );
  }
};

const deleteAll = async (table) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=not.is.null`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });

  if (!response.ok) {
    throw new Error(`Supabase ${table} delete failed: ${await response.text()}`);
  }
};

const main = async () => {
  const catalog = readCatalog();
  console.log(`Parsed ${String(catalog.length)} products from ${SOURCE_DIR}/`);

  // Fail fast with an actionable message if the migration has not been applied.
  const probe = await fetch(`${SUPABASE_URL}/rest/v1/products?select=slug&limit=1`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });

  if (probe.status === 404) {
    console.error(
      '\nThe `products` table does not exist.\n' +
        'Apply supabase/migrations/0001_init.sql in the Supabase SQL Editor first.\n',
    );
    process.exit(1);
  }

  const rows = [];

  for (const [index, product] of catalog.entries()) {
    const image = await uploadImage(product.sourceFile, product.publicId);
    const asset = { ...image, alt: product.title };

    console.log(`  [${String(index + 1).padStart(2)}/${String(catalog.length)}] ${product.slug}`);

    rows.push({
      title: product.title,
      subtitle: product.subtitle,
      ribbon: product.ribbon,
      description: product.description,
      images: [asset],
      thumbnail: asset,

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

  await postRows('products', rows, { onConflict: 'slug' });
  console.log(`Upserted ${String(rows.length)} products.`);

  // Hero slides reuse three catalogue photographs as right-aligned hero imagery.
  const slideSources = [
    {
      product: rows[1],
      title: 'Festive Season Edit',
      subtitle: 'Up to 60% off on designer sarees',
    },
    {
      product: rows[8],
      title: 'Handwoven Heritage',
      subtitle: 'Banarasi and Kanjeevaram, made to last',
    },
    {
      product: rows[14],
      title: 'Everyday Elegance',
      subtitle: 'Linen and cotton drapes for daily wear',
    },
  ];

  await deleteAll('carousel');
  await postRows(
    'carousel',
    slideSources.map((slide, index) => ({
      title: slide.title,
      subtitle: slide.subtitle,
      image: { ...slide.product.thumbnail, alt: slide.title },
      button_text: 'Shop the edit',
      button_link: '/shop/women',
      display_order: index + 1,
      active: true,
    })),
  );
  console.log(`Inserted ${String(slideSources.length)} carousel slides.`);

  // Attach a category cover so the homepage category cards have real imagery.
  const coverResponse = await fetch(`${SUPABASE_URL}/rest/v1/categories?slug=eq.women`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ cover_image: rows[3].thumbnail }),
  });

  if (!coverResponse.ok) {
    throw new Error(`Category cover update failed: ${await coverResponse.text()}`);
  }

  console.log('Seed complete.');
};

await main();
