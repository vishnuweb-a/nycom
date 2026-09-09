import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Women's denim catalogue, built from the `women-jeans` photography.
 *
 * Unlike `catalog.mjs`, this source is not derived purely from filenames. The
 * folder ships one directory per garment with several shots each, and two
 * filenames disagree with what the photograph actually shows — the folder
 * named "…-beige" is a tinted blue wash, and the two Moda Rapido pairs carry
 * no colour token at all but are plainly charcoal. Colour, fit and the choice
 * of hero shot were therefore read off the images and are recorded here, so
 * the listing never contradicts its own photograph.
 *
 * Everything else follows `catalog.mjs`: brand comes from the duplicated brand
 * prefix in the folder name, and commercial values no photograph can carry are
 * hashed from the slug so repeated runs produce identical data.
 */

export const WOMEN_JEANS_DIR = 'women-jeans';

/** The two permitted price points for this range. */
const PRICE_POINTS = [100, 149];

/** Waist sizes, matching the adult sizing already used for menswear denim. */
const SIZES = ['26', '28', '30', '32', '34'];

/**
 * One entry per source folder.
 *
 * `hero` names the shot used as the thumbnail — a clean, front-facing view of
 * the garment. It matters because some folders lead with a styling collage
 * ("4 Ways to Wear") that reads as an advert rather than a product, and one
 * lists a rear view first purely because of alphabetical ordering.
 *
 * `colour` is what the photograph shows, which is not always what the filename
 * claims. `noun` lets the white cargo pair be described as the trousers it is
 * rather than being forced into the jeans wording.
 */
const GARMENTS = [
  {
    dir: 'aadvi-fashion-aadvi-fashion-women-comfort-baggy-fit-high-rise-stretchable-jeans',
    title: 'Comfort Baggy Fit High Rise Jeans',
    hero: 'aadvi-fashion-aadvi-fashion-women-comfort-baggy-fit-high-rise-stretchable-jeans.jpg',
    colour: 'Light Blue',
    fit: 'baggy fit',
    rise: 'high rise',
    stretch: true,
    price: 149,
  },
  {
    dir: 'aadvi-fashion-aadvi-fashion-women-loose-high-rise-stretchable-jeans-beige',
    // Filename says "beige"; every shot in the folder is a tinted vintage blue wash.
    title: 'Loose Fit Vintage Wash Wide Leg Jeans',
    hero: 'aadvi-fashion-aadvi-fashion-women-loose-high-rise-stretchable-jeans-beige-10.jpg',
    colour: 'Blue',
    fit: 'loose fit',
    rise: 'mid rise',
    stretch: true,
    price: 149,
  },
  {
    dir: 'adbucks-adbucks-women-bootcut-high-rise-stretchable-jeans-black',
    title: 'Bootcut High Rise Stretchable Jeans',
    // `-model.jpg` is a "4 Ways to Wear" collage, so the plain styled shot leads.
    hero: 'adbucks-adbucks-women-bootcut-high-rise-stretchable-jeans-black-6.jpg',
    colour: 'Black',
    fit: 'bootcut',
    rise: 'high rise',
    stretch: true,
    price: 149,
  },
  {
    dir: 'adbucks-adbucks-women-wide-leg-high-rise-light-fade-stretchable-jeans-blue',
    title: 'Wide Leg High Rise Light Fade Jeans',
    hero: 'adbucks-adbucks-women-wide-leg-high-rise-light-fade-stretchable-jeans-blue-front.jpg',
    colour: 'Light Blue',
    fit: 'wide leg',
    rise: 'high rise',
    stretch: true,
    price: 149,
  },
  {
    dir: 'comfits-comfits-women-classic-regular-fit-mid-rise-low-distress-stretchable-grey',
    title: 'Classic Regular Fit Mid Rise Jeans',
    hero: 'comfits-comfits-women-classic-regular-fit-mid-rise-low-distress-stretchable-grey.jpg',
    colour: 'Grey',
    fit: 'regular fit',
    rise: 'mid rise',
    stretch: true,
    price: 100,
  },
  {
    dir: 'comfits-comfits-womenen-classic-regular-fit-mid-rise-low-distress-stretchable',
    title: 'Low Distress Straight Leg Jeans',
    hero: 'comfits-comfits-womenen-classic-regular-fit-mid-rise-low-distress-stretchable.jpg',
    colour: 'Grey',
    fit: 'straight fit',
    rise: 'mid rise',
    stretch: true,
    price: 100,
  },
  {
    dir: 'flaring-flaring-women-classic-easy-wash-cargos-trousers-white',
    // Cargo trousers, not five-pocket jeans — titled for what the photo shows.
    title: 'Classic Easy Wash Cargo Trousers',
    hero: 'flaring-flaring-women-classic-easy-wash-cargos-trousers-white-model.jpg',
    colour: 'White',
    fit: 'straight fit',
    rise: 'mid rise',
    stretch: false,
    noun: 'Trousers',
    price: 149,
  },
  {
    dir: 'jeancherry-jeancherry-women-classic-regular-fit-mid-rise-stretchable-jeans-grey',
    title: 'Classic Mid Rise Relaxed Straight Jeans',
    hero: 'jeancherry-jeancherry-women-classic-regular-fit-mid-rise-stretchable-jeans-grey.jpg',
    colour: 'Grey',
    fit: 'relaxed fit',
    rise: 'mid rise',
    stretch: true,
    price: 100,
  },
  {
    dir: 'kashianxstyle-kashianxstyle-women-relaxed-fit-high-rise-light-fade-jeans-black',
    title: 'Relaxed Fit High Rise Wide Leg Jeans',
    hero: 'kashianxstyle-kashianxstyle-women-relaxed-fit-high-rise-light-fade-jeans-black.jpg',
    colour: 'Black',
    fit: 'relaxed fit',
    rise: 'high rise',
    stretch: false,
    price: 149,
  },
  {
    dir: 'moda-rapido-moda-rapido-women-classic-regular-fit-mid-rise-low-distress-jeans',
    // No colour token in the filename; the photograph is a washed charcoal.
    title: 'Low Distress Wide Leg Denim',
    hero: 'moda-rapido-moda-rapido-women-classic-regular-fit-mid-rise-low-distress-jeans.jpg',
    colour: 'Dark Grey',
    fit: 'wide leg',
    rise: 'mid rise',
    stretch: false,
    price: 100,
  },
  {
    dir: 'moda-rapido-moda-rapido-women-classic-regular-fit-mid-rise-stretchable-jeans',
    title: 'Classic Regular Fit Stretchable Denim',
    hero: 'moda-rapido-moda-rapido-women-classic-regular-fit-mid-rise-stretchable-jeans.jpg',
    colour: 'Dark Grey',
    fit: 'regular fit',
    rise: 'mid rise',
    stretch: true,
    price: 100,
  },
  {
    dir: 'nifty-nifty-women-high-rise-baggy-fit-jeans-blue',
    title: 'High Rise Baggy Fit Jeans',
    hero: 'nifty-nifty-women-high-rise-baggy-fit-jeans-blue-front.jpg',
    colour: 'Dark Blue',
    fit: 'baggy fit',
    rise: 'high rise',
    stretch: false,
    price: 149,
  },
  {
    dir: 'szn-szn-women-classic-regular-fit-mid-rise-stretchable-jeans-grey',
    title: 'Classic Mid Rise Straight Fit Jeans',
    hero: 'szn-szn-women-classic-regular-fit-mid-rise-stretchable-jeans-grey-front.jpg',
    colour: 'Grey',
    fit: 'straight fit',
    rise: 'mid rise',
    stretch: true,
    price: 100,
  },
  {
    dir: 'zayla-zayla-women-jean-flared-high-rise-heavy-fade-jeans-blue',
    title: 'Flared High Rise Heavy Fade Jeans',
    hero: 'zayla-zayla-women-jean-flared-high-rise-heavy-fade-jeans-blue-front.jpg',
    colour: 'Blue',
    fit: 'flared',
    rise: 'high rise',
    stretch: true,
    price: 149,
  },
];

/** Brands whose display name does not survive naive title casing. */
const BRAND_OVERRIDES = {
  szn: 'SZN',
  kashianxstyle: 'KashianxStyle',
  jeancherry: 'JeanCherry',
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

/** Strips the duplicated brand prefix: `adbucks-adbucks-x` → `adbucks`. */
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

/** Builds variants across the waist sizes, with deterministic per-size stock. */
const buildVariants = (slug, colour) =>
  SIZES.map((size) => {
    // Every size carries stock: a fixed-price range with sold-out waists reads
    // as a broken listing rather than a deliberate one.
    const quantity = pick(`${slug}:${size}:qty`, 6, 24);

    return { size, color: colour, quantity, stock: 'in_stock' };
  });

/**
 * Reads the women's denim folder into product records shaped like those from
 * `readCatalog`, with one addition: `shots` carries every photograph for the
 * garment, so a listing can show the full set rather than a single frame.
 */
export const readWomenJeans = () => {
  if (!existsSync(WOMEN_JEANS_DIR)) {
    throw new Error(`Source folder not found: ${WOMEN_JEANS_DIR}`);
  }

  return GARMENTS.map((garment) => {
    const dir = path.join(WOMEN_JEANS_DIR, garment.dir);

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
    const noun = garment.noun ?? 'Jeans';

    const slug =
      `${brandSlug}-${garment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${garment.colour
        .toLowerCase()
        .replace(/ /g, '-')}`
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    const title = `${garment.title} — ${garment.colour}`;
    const shots = orderShots(files, garment.hero);

    const fabric = garment.stretch ? 'Stretchable Denim' : 'Denim';
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
      subtitle: `${brand} · ${fabric} ${noun}`,
      ribbon: newArrival ? 'New In' : topSelling ? 'Bestseller' : null,
      description:
        `${title} by ${brand}. ` +
        `A ${garment.rise} ${garment.fit} ${noun.toLowerCase()} cut in ` +
        `${garment.colour.toLowerCase()} ${fabric.toLowerCase()}. ` +
        'Machine washable. Model is 5\'8" and wears a size 28.',

      price: garment.price,
      // Fixed-price range: the sticker price is the price paid.
      discountPrice: null,
      sku: `YV-${brandSlug.slice(0, 3).toUpperCase()}-${String(hash(slug) % 100000).padStart(5, '0')}`,
      weightGrams: pick(`${slug}:weight`, 420, 780),

      category: 'women',
      gender: 'Women',
      brand,
      collection: `${titleCase(garment.fit)} Edit`,
      season: choose(`${slug}:season`, ['Summer', 'All Season']),
      material: fabric,
      occasion: choose(`${slug}:occasion`, ['Casual', 'Everyday', 'Weekend']),

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
        `${garment.rise} ${garment.fit} ${noun.toLowerCase()} in ${fabric.toLowerCase()}. ` +
        'Free delivery and easy 7-day returns.',

      // Alt text describes the garment, so it stands alone for a screen reader.
      alt: `Women's ${garment.rise} ${garment.fit} ${garment.colour.toLowerCase()} ${noun.toLowerCase()}`,

      tags: [
        noun.toLowerCase(),
        'denim',
        `brand:${brandSlug}`,
        `color:${garment.colour.toLowerCase().replace(/ /g, '-')}`,
        'stock:in',
        garment.fit.replace(/ /g, '-'),
        garment.rise.replace(/ /g, '-'),
      ],
    };
  });
};
