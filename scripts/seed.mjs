import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { readCatalog } from './catalog.mjs';

/**
 * Uploads the source photography to Cloudinary and seeds Supabase.
 *
 * Run with:  npm run seed
 *
 * Idempotent. Cloudinary uploads use a deterministic `public_id` with
 * `overwrite`, and products upsert on `slug`, so re-running updates in place
 * rather than duplicating. Each photograph uploads once even when two product
 * rows share it. Requires `supabase/migrations/0001_init.sql` to be applied.
 */

const CLOUDINARY_FOLDER = 'yarnvia/products';

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
  const query = onConflict === undefined ? '' : `?on_conflict=${onConflict}`;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders,
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

const main = async () => {
  const catalog = readCatalog();

  const probe = await fetch(`${SUPABASE_URL}/rest/v1/products?select=slug&limit=1`, {
    headers: supabaseHeaders,
  });

  if (probe.status === 404) {
    console.error(
      '\nThe `products` table does not exist.\n' +
        'Apply supabase/migrations/0001_init.sql in the Supabase SQL Editor first.\n',
    );
    process.exit(1);
  }

  // Upload each photograph once, even when several product rows reference it.
  const unique = new Map();

  for (const product of catalog) {
    if (!unique.has(product.fileKey)) {
      unique.set(product.fileKey, { dir: product.sourceDir, file: product.sourceFile });
    }
  }

  console.log(
    `Parsed ${String(catalog.length)} products across ${String(unique.size)} photographs.`,
  );

  const assets = new Map();
  let uploaded = 0;

  for (const [fileKey, { dir, file }] of unique) {
    const image = await uploadImage(dir, file, `${CLOUDINARY_FOLDER}/${fileKey}`);
    assets.set(fileKey, image);
    uploaded += 1;
    console.log(`  [${String(uploaded).padStart(2)}/${String(unique.size)}] ${fileKey}`);
  }

  const rows = catalog.map((product) => {
    const asset = { ...assets.get(product.fileKey), alt: product.title };

    return {
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
    };
  });

  await postRows('products', rows, 'slug');
  console.log(`Upserted ${String(rows.length)} products.`);

  // Category covers: the first product of each category supplies the imagery.
  for (const slug of ['women', 'men', 'children']) {
    const cover = rows.find((row) => row.category === slug)?.thumbnail;

    if (cover === undefined) {
      continue;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/categories?slug=eq.${slug}`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ cover_image: cover }),
    });

    if (!response.ok) {
      throw new Error(`Category cover update failed for ${slug}: ${await response.text()}`);
    }
  }
  console.log('Updated category covers.');

  // Hero slides, one per category so the banner reflects the whole catalogue.
  const slideSpecs = [
    {
      category: 'women',
      title: 'Festive Season Edit',
      subtitle: 'Handwoven sarees, up to 60% off',
      link: '/shop/women',
    },
    {
      category: 'children',
      title: 'Denim Built for Play',
      subtitle: 'Tough, comfortable jeans for every adventure',
      link: '/shop/children',
    },
    {
      category: 'men',
      title: 'Everyday Denim',
      subtitle: 'Clean cuts and honest fabric',
      link: '/shop/men',
    },
  ];

  const slides = slideSpecs
    .map((spec, index) => {
      const source = rows.find((row) => row.category === spec.category);

      return source === undefined
        ? null
        : {
            title: spec.title,
            subtitle: spec.subtitle,
            image: { ...source.thumbnail, alt: spec.title },
            button_text: 'Shop the edit',
            button_link: spec.link,
            display_order: index + 1,
            active: true,
          };
    })
    .filter((slide) => slide !== null);

  const purge = await fetch(`${SUPABASE_URL}/rest/v1/carousel?id=not.is.null`, {
    method: 'DELETE',
    headers: supabaseHeaders,
  });

  if (!purge.ok) {
    throw new Error(`Carousel purge failed: ${await purge.text()}`);
  }

  await postRows('carousel', slides);
  console.log(`Inserted ${String(slides.length)} carousel slides.`);
  console.log('Seed complete.');
};

await main();
