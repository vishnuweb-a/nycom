import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Adds hand-written products to the catalogue.
 *
 * Run with:  npm run add-products
 *
 * `scripts/seed.mjs` derives every product from the source photography, so it
 * cannot express a listing whose price is chosen rather than generated. This
 * script covers that case: the rows below are written out in full and upsert on
 * `slug`, so re-running updates them in place rather than duplicating. Each
 * photograph is uploaded under its own `public_id`, keeping these listings
 * independent of the seeded rows that share the same source file.
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

/**
 * The listings. Everything the `products` table can hold is stated here; only
 * the Cloudinary asset is filled in at upload time.
 */
const PRODUCTS = [
  {
    sourceDir: 'clothes',
    sourceFile: 'sayan-creation-sayan-creation-pure-cotton-khadi-saree-grey-7.jpg',
    publicId: 'trial-drape-pure-cotton-khadi-saree-grey',

    title: 'Trial Drape Pure Cotton Khadi Saree — Grey',
    subtitle: 'Yarnvia · Pure Cotton Saree',
    ribbon: 'Trial Listing',
    description:
      'Trial Drape Pure Cotton Khadi Saree by Yarnvia. Made in pure cotton khadi with a soft ' +
      'hand-spun texture that breathes through a full day of wear. Comes with an unstitched ' +
      'blouse piece. Drape length 5.5 m, blouse 0.8 m.',

    price: 2,
    discountPrice: null,
    sku: 'YV-TRL-00002',
    weightGrams: 620,

    category: 'women',
    gender: 'Women',
    brand: 'Yarnvia',
    collection: 'Everyday Drapes',
    season: 'All Season',
    material: 'Pure Cotton',
    occasion: 'Casual',

    variants: [{ size: 'Free Size', color: 'Grey', quantity: 25, stock: 'in_stock' }],

    rating: 0,
    reviewCount: 0,

    featured: false,
    topSelling: false,
    newArrival: true,
    trending: false,
    active: true,

    slug: 'trial-drape-pure-cotton-khadi-saree-grey',
    metaTitle: 'Trial Drape Pure Cotton Khadi Saree — Grey | Yarnvia',
    metaDescription:
      'Shop the Trial Drape Pure Cotton Khadi Saree in grey at Yarnvia. Pure cotton saree with ' +
      'an unstitched blouse piece. Free delivery and easy 7-day returns.',

    tags: [
      'saree',
      'brand:yarnvia',
      'color:grey',
      'stock:in',
      'material:pure-cotton',
      'khadi',
      'trial',
    ],
  },
  {
    sourceDir: 'clothes',
    sourceFile: 'kalini-kalini-floral-linen-blend-block-print-saree-off-white-8.jpg',
    publicId: 'trial-drape-floral-linen-blend-saree-off-white',

    title: 'Trial Drape Floral Linen Blend Block Print Saree — Off White',
    subtitle: 'Yarnvia · Linen Blend Saree',
    ribbon: 'Trial Listing',
    description:
      'Trial Drape Floral Linen Blend Block Print Saree by Yarnvia. Made in a linen blend with ' +
      'a hand-block floral print across the body and a matching pallu. Comes with an unstitched ' +
      'blouse piece. Drape length 5.5 m, blouse 0.8 m.',

    price: 110,
    discountPrice: null,
    sku: 'YV-TRL-00110',
    weightGrams: 480,

    category: 'women',
    gender: 'Women',
    brand: 'Yarnvia',
    collection: 'Everyday Drapes',
    season: 'Summer',
    material: 'Linen Blend',
    occasion: 'Casual',

    variants: [{ size: 'Free Size', color: 'Off White', quantity: 18, stock: 'in_stock' }],

    rating: 0,
    reviewCount: 0,

    featured: false,
    topSelling: false,
    newArrival: true,
    trending: false,
    active: true,

    slug: 'trial-drape-floral-linen-blend-saree-off-white',
    metaTitle: 'Trial Drape Floral Linen Blend Block Print Saree — Off White | Yarnvia',
    metaDescription:
      'Shop the Trial Drape Floral Linen Blend Block Print Saree in off white at Yarnvia. Linen ' +
      'blend saree with an unstitched blouse piece. Free delivery and easy 7-day returns.',

    tags: [
      'saree',
      'brand:yarnvia',
      'color:off-white',
      'stock:in',
      'material:linen-blend',
      'block-print',
      'trial',
    ],
  },
];

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

const main = async () => {
  const rows = [];

  for (const product of PRODUCTS) {
    const image = await uploadImage(
      product.sourceDir,
      product.sourceFile,
      `${CLOUDINARY_FOLDER}/${product.publicId}`,
    );

    const asset = { ...image, alt: product.title };
    console.log(`  uploaded ${asset.public_id}`);

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
      active: product.active,

      slug: product.slug,
      meta_title: product.metaTitle,
      meta_description: product.metaDescription,
      tags: product.tags,
    });
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=slug`, {
    method: 'POST',
    headers: { ...supabaseHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase products write failed (${String(response.status)}): ${await response.text()}`,
    );
  }

  for (const row of rows) {
    console.log(`  upserted ${row.slug} at INR ${String(row.price)}`);
  }
};

await main();
