import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Women's shorts and skirts catalogue, built from the `women-shorts-skirts`
 * photography.
 *
 * Structured like `women-jeans.mjs`: one directory per garment with several
 * shots each, so the same problems apply — filenames are unreliable and the
 * alphabetically-first file is not always the shot a customer should see
 * first. Every entry below was read off the photographs rather than the
 * folder name, and three of them contradict their filename outright:
 *
 *   - `…-shorts-black` from StyleCast x Slyck is a *skort*: a wrap-front mini
 *     skirt with shorts beneath. It is listed under Skirts.
 *   - `…-midi-skirt-navy-blue` from Kotty is a mid-blue wash, not navy, and
 *     falls below the calf rather than at mid-shin.
 *   - `…-denim-shorts-blue` from Aadvi Fashion is a below-knee wide-leg cut,
 *     so it is titled as long shorts rather than the brief cut "shorts" implies.
 *
 * `type` drives the collection, the SKU prefix and the tags, which is why it
 * is stated per garment rather than guessed from the folder name.
 */

export const WOMEN_SHORTS_SKIRTS_DIR = 'women-shorts-skirts';

/** The two permitted price points for this range. */
const PRICE_POINTS = [100, 149];

/** Apparel sizing, as used by the storefront's non-denim womenswear. */
const SIZES = ['S', 'M', 'L', 'XL'];

/**
 * One entry per source folder.
 *
 * `hero` names the thumbnail shot — a clean view that shows the whole garment.
 * Where a folder's `-front.jpg` is cropped at the thigh, a full-length frame is
 * chosen instead, so the product card is not a close-up of a waistband.
 *
 * `colour` is what the photograph shows. `noun` is the garment word used in the
 * title, description and alt text; `type` files it into Shorts or Skirts.
 */
const GARMENTS = [
  {
    dir: 'aadvi-fashion-aadvi-fashion-women-loose-fit-high-rise-denim-shorts-blue',
    // Below-knee wide-leg cut — "shorts" alone would misdescribe the length.
    title: 'Loose Fit High Rise Wide Leg Denim Shorts',
    hero: 'aadvi-fashion-aadvi-fashion-women-loose-fit-high-rise-denim-shorts-blue-model.jpg',
    type: 'shorts',
    colour: 'Light Blue',
    fit: 'loose fit',
    rise: 'high rise',
    length: 'below-knee',
    material: 'Denim',
    occasion: 'Casual',
    price: 149,
  },
  {
    dir: 'avanova-avanova-women-denim-shorts-navy-blue',
    title: 'Patch Pocket High Rise Denim Shorts',
    hero: 'avanova-avanova-women-denim-shorts-navy-blue-front.jpg',
    type: 'shorts',
    colour: 'Dark Blue',
    fit: 'regular fit',
    rise: 'high rise',
    length: 'mid-thigh',
    material: 'Denim',
    occasion: 'Everyday',
    price: 149,
  },
  {
    dir: 'avanova-avanova-women-high-rise-denim-shorts-black',
    title: 'High Rise Pleated Denim Shorts',
    hero: 'avanova-avanova-women-high-rise-denim-shorts-black-front.jpg',
    type: 'shorts',
    colour: 'Black',
    fit: 'relaxed fit',
    rise: 'high rise',
    length: 'mid-thigh',
    material: 'Denim',
    occasion: 'Everyday',
    price: 149,
  },
  {
    dir: 'glitchez-glitchez-women-faded-jorts-black',
    title: 'Faded Baggy Knee Length Jorts',
    // `-front.jpg` crops at the waist; the model shot shows the full cut.
    hero: 'glitchez-glitchez-women-faded-jorts-black-model.jpg',
    type: 'shorts',
    colour: 'Black',
    fit: 'baggy fit',
    rise: 'mid rise',
    length: 'knee-length',
    material: 'Denim',
    occasion: 'Casual',
    price: 149,
  },
  {
    dir: 'house-of-fitness-house-of-fitness-women-training-or-gym-sports-shorts-black',
    title: 'Training 2-in-1 Sports Shorts',
    // The unsuffixed file is a cropped side view; `-6` is the full-length frame.
    hero: 'house-of-fitness-house-of-fitness-women-training-or-gym-sports-shorts-black-6.jpg',
    type: 'shorts',
    colour: 'Black',
    fit: 'regular fit',
    rise: 'mid rise',
    length: 'mid-thigh',
    material: 'Polyester Blend',
    occasion: 'Sports',
    price: 100,
  },
  {
    dir: 'roadster-the-roadster-lifestyle-co-women-pure-cotton-shorts-beige',
    title: 'Pure Cotton Relaxed Shorts',
    hero: 'roadster-the-roadster-lifestyle-co-women-pure-cotton-shorts-beige-front.jpg',
    type: 'shorts',
    colour: 'Beige',
    fit: 'relaxed fit',
    rise: 'mid rise',
    length: 'mid-thigh',
    material: 'Cotton',
    occasion: 'Everyday',
    price: 100,
  },
  {
    dir: 'sassafras-basics-sassafras-basics-women-washed-high-rise-denim-denim-shorts-blue',
    title: 'Washed High Rise Denim Shorts',
    hero: 'sassafras-basics-sassafras-basics-women-washed-high-rise-denim-denim-shorts-blue.jpg',
    type: 'shorts',
    colour: 'Blue',
    fit: 'regular fit',
    rise: 'high rise',
    length: 'mid-thigh',
    material: 'Denim',
    occasion: 'Casual',
    price: 100,
  },
  {
    dir: 'kotty-kotty-denim-pencil-midi-skirt-navy-blue',
    // Filename says navy; the wash photographed is a mid blue.
    title: 'Front Slit Denim Pencil Skirt',
    hero: 'kotty-kotty-denim-pencil-midi-skirt-navy-blue-front.jpg',
    type: 'skirt',
    colour: 'Blue',
    fit: 'pencil fit',
    rise: 'high rise',
    length: 'maxi',
    material: 'Denim',
    occasion: 'Everyday',
    price: 149,
  },
  {
    dir: 'street-9-street-9-a-line-midi-satin-skirt-brown',
    title: 'A-Line Satin Midi Skirt',
    hero: 'street-9-street-9-a-line-midi-satin-skirt-brown-front.jpg',
    type: 'skirt',
    colour: 'Brown',
    fit: 'A-line',
    rise: 'high rise',
    length: 'midi',
    material: 'Satin',
    occasion: 'Workwear',
    price: 149,
  },
  {
    dir: 'style-quotient-plus-style-quotient-plus-women-cotton-front-slit-midi-a-line',
    // No colour token in the filename; the photograph is a washed black.
    title: 'Cotton Button Front A-Line Midi Skirt',
    hero: 'style-quotient-plus-style-quotient-plus-women-cotton-front-slit-midi-a-line.jpg',
    type: 'skirt',
    colour: 'Black',
    fit: 'A-line',
    rise: 'high rise',
    length: 'midi',
    material: 'Cotton',
    occasion: 'Everyday',
    price: 100,
  },
  {
    dir: 'stylecast-x-revolte-stylecast-x-revolte-women-tiered-mini-skirt-white',
    title: 'Tiered Ruffle Mini Skirt',
    hero: 'stylecast-x-revolte-stylecast-x-revolte-women-tiered-mini-skirt-white-front.jpg',
    type: 'skirt',
    colour: 'White',
    fit: 'flared',
    rise: 'mid rise',
    length: 'mini',
    material: 'Polyester Blend',
    occasion: 'Casual',
    price: 100,
  },
  {
    dir: 'stylecast-x-slyck-stylecast-x-slyck-women-high-rise-shorts-black',
    // Filename says shorts; the garment is a wrap-front skort.
    title: 'High Rise Wrap Front Skort',
    hero: 'stylecast-x-slyck-stylecast-x-slyck-women-high-rise-shorts-black-front.jpg',
    type: 'skirt',
    colour: 'Black',
    fit: 'straight fit',
    rise: 'high rise',
    length: 'mini',
    material: 'Cotton Blend',
    occasion: 'Casual',
    noun: 'Skort',
    price: 100,
  },
  {
    dir: 'sunekh-sunekh-floral-printed-cotton-flared-maxi-skirt-maroon',
    title: 'Floral Printed Flared Maxi Skirt',
    hero: 'sunekh-sunekh-floral-printed-cotton-flared-maxi-skirt-maroon-front.jpg',
    type: 'skirt',
    colour: 'Maroon',
    fit: 'flared',
    rise: 'high rise',
    length: 'maxi',
    material: 'Cotton',
    occasion: 'Festive',
    price: 149,
  },
  {
    dir: 'zastraa-zastraa-aw-2025-high-waisted-straight-midi-skirt-off-white',
    title: 'High Waisted Satin Flared Skirt',
    hero: 'zastraa-zastraa-aw-2025-high-waisted-straight-midi-skirt-off-white-front.jpg',
    type: 'skirt',
    colour: 'Off White',
    fit: 'flared',
    rise: 'high rise',
    length: 'maxi',
    material: 'Satin',
    occasion: 'Workwear',
    price: 149,
  },
  {
    dir: 'zucchini-zucchini-women-lace-lace-frills-bows-and-ruffles-midi-trumpet-skirt-off',
    title: 'Lace Ruffled Trumpet Midi Skirt',
    hero: 'zucchini-zucchini-women-lace-lace-frills-bows-and-ruffles-midi-trumpet-skirt-off.jpg',
    type: 'skirt',
    colour: 'Cream',
    fit: 'trumpet',
    rise: 'high rise',
    length: 'midi',
    material: 'Lace',
    occasion: 'Party',
    price: 149,
  },
];

/** Brands whose display name does not survive naive title casing. */
const BRAND_OVERRIDES = {
  'street-9': 'Street 9',
  'stylecast-x-revolte': 'StyleCast x Revolte',
  'stylecast-x-slyck': 'StyleCast x Slyck',
  'house-of-fitness': 'House of Fitness',
  'sassafras-basics': 'SASSAFRAS Basics',
  'style-quotient-plus': 'Style Quotient Plus',
  roadster: 'Roadster',
  glitchez: 'Glitchez',
  avanova: 'Avanova',
  kotty: 'Kotty',
  sunekh: 'Sunekh',
  zastraa: 'Zastraa',
  zucchini: 'Zucchini',
};

/** Stable 32-bit hash so every derived value is reproducible across runs. */
const hash = (value) => parseInt(createHash('sha1').update(value).digest('hex').slice(0, 8), 16);

const pick = (seed, min, max) => min + (hash(seed) % (max - min + 1));

const choose = (seed, list) => list[hash(seed) % list.length];

const titleCase = (value) =>
  value
    .split(' ')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Strips the duplicated brand prefix: `avanova-avanova-x` → `avanova`. */
const brandSlugOf = (dir) => {
  const parts = dir.split('-');

  for (let size = Math.floor(parts.length / 2); size >= 1; size -= 1) {
    if (parts.slice(0, size).join('-') === parts.slice(size, size * 2).join('-')) {
      return parts.slice(0, size).join('-');
    }
  }

  return parts[0];
};

/**
 * Orders a folder's shots so the hero leads and the rest follow a predictable
 * front → side → back → detail → model sequence, with numbered extras last.
 */
const VIEW_ORDER = ['front', 'side', 'back', 'detail', 'model'];

const viewRank = (file) => {
  const index = VIEW_ORDER.findIndex((view) => file.includes(`-${view}.`));

  return index === -1 ? VIEW_ORDER.length : index;
};

const orderShots = (files, hero) =>
  [...files].sort((a, b) => {
    if (a === hero) {
      return -1;
    }
    if (b === hero) {
      return 1;
    }

    const rank = viewRank(a) - viewRank(b);

    return rank === 0 ? a.localeCompare(b) : rank;
  });

/** Builds variants across the apparel sizes, with deterministic per-size stock. */
const buildVariants = (slug, colour) =>
  SIZES.map((size) => {
    // Every size carries stock: a fixed-price range with sold-out sizes reads
    // as a broken listing rather than a deliberate one.
    const quantity = pick(`${slug}:${size}:qty`, 6, 24);

    return { size, color: colour, quantity, stock: 'in_stock' };
  });

/** The garment word used in copy, defaulting to the type. */
const nounOf = (garment) => garment.noun ?? (garment.type === 'shorts' ? 'Shorts' : 'Skirt');

/**
 * Reads the shorts-and-skirts folder into product records shaped like those
 * from `readWomenJeans`, so `seed-women-shorts-skirts.mjs` can consume them
 * with the same field mapping.
 */
export const readWomenShortsSkirts = () => {
  if (!existsSync(WOMEN_SHORTS_SKIRTS_DIR)) {
    throw new Error(`Source folder not found: ${WOMEN_SHORTS_SKIRTS_DIR}`);
  }

  const seen = new Set();

  return GARMENTS.map((garment) => {
    const dir = path.join(WOMEN_SHORTS_SKIRTS_DIR, garment.dir);

    if (!existsSync(dir)) {
      throw new Error(`Source folder not found: ${dir}`);
    }

    const files = readdirSync(dir).filter((file) => /\.(jpe?g|png|webp)$/i.test(file));

    if (files.length === 0) {
      throw new Error(`No usable images in ${dir}`);
    }

    if (!files.includes(garment.hero)) {
      throw new Error(`Hero image ${garment.hero} is missing from ${dir}`);
    }

    if (!PRICE_POINTS.includes(garment.price)) {
      throw new Error(`${garment.dir}: price ${String(garment.price)} is not a permitted price`);
    }

    const brandSlug = brandSlugOf(garment.dir);
    const brand = BRAND_OVERRIDES[brandSlug] ?? titleCase(brandSlug.replace(/-/g, ' '));
    const noun = nounOf(garment);

    const slug =
      `${brandSlug}-${garment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${garment.colour
        .toLowerCase()
        .replace(/ /g, '-')}`
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    if (seen.has(slug)) {
      throw new Error(`Duplicate slug generated: ${slug}`);
    }

    seen.add(slug);

    const title = `${garment.title} — ${garment.colour}`;
    const shots = orderShots(files, garment.hero);

    const collection = garment.type === 'shorts' ? 'Shorts' : 'Skirts';
    const newArrival = hash(`${slug}:new`) % 100 < 30;
    const topSelling = hash(`${slug}:top`) % 100 < 40;

    return {
      sourceDir: dir,
      // Hero first: the seeder uses index 0 for the thumbnail.
      shots: shots.map((file) => ({
        file,
        // Cloudinary public_id, unique per photograph and stable across runs.
        key: path.basename(file, path.extname(file)),
      })),

      title,
      subtitle: `${brand} · ${garment.material} ${noun}`,
      ribbon: newArrival ? 'New In' : topSelling ? 'Bestseller' : null,
      description:
        `${title} by ${brand}. ` +
        `A ${garment.rise} ${garment.fit} ${noun.toLowerCase()} cut to a ${garment.length} ` +
        `length in ${garment.colour.toLowerCase()} ${garment.material.toLowerCase()}. ` +
        'Machine washable. Model is 5\'8" and wears a size M.',

      price: garment.price,
      // Fixed-price range: the sticker price is the price paid.
      discountPrice: null,
      sku: `YV-${garment.type === 'shorts' ? 'WSH' : 'WSK'}-${String(hash(slug) % 100000).padStart(5, '0')}`,
      weightGrams: pick(`${slug}:weight`, 180, 460),

      category: 'women',
      gender: 'Women',
      brand,
      collection,
      season: choose(`${slug}:season`, ['Summer', 'All Season']),
      material: garment.material,
      occasion: garment.occasion,

      variants: buildVariants(slug, garment.colour),

      rating: Number((pick(`${slug}:rating`, 38, 49) / 10).toFixed(1)),
      reviewCount: pick(`${slug}:reviews`, 12, 486),

      featured: hash(`${slug}:featured`) % 100 < 45,
      topSelling,
      newArrival,
      trending: hash(`${slug}:trend`) % 100 < 25,

      slug,
      metaTitle: `${title} | Yarnvia`,
      metaDescription:
        `Shop the ${title} by ${brand} at Yarnvia. ` +
        `${garment.rise} ${garment.fit} ${noun.toLowerCase()} in ${garment.material.toLowerCase()}. ` +
        'Free delivery and easy 7-day returns.',

      // Alt text describes the garment, so it stands alone for a screen reader.
      alt:
        `Women's ${garment.rise} ${garment.fit} ${garment.colour.toLowerCase()} ` +
        `${garment.material.toLowerCase()} ${noun.toLowerCase()}`,

      tags: [
        'women',
        noun.toLowerCase(),
        'bottomwear',
        garment.material.toLowerCase().replace(/ /g, '-'),
        `brand:${brandSlug}`,
        `color:${garment.colour.toLowerCase().replace(/ /g, '-')}`,
        'stock:in',
        garment.fit.toLowerCase().replace(/ /g, '-'),
        garment.rise.replace(/ /g, '-'),
        garment.occasion.toLowerCase(),
      ],
    };
  });
};
