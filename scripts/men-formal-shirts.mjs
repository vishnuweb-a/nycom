import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Men's formal shirt catalogue, built from the `men-formal-shirts`
 * photography.
 *
 * Structured like `women-shorts-skirts.mjs`: one directory per garment with
 * several shots each. The same caveat applies — the folder names come from the
 * source listings and several of them misdescribe the photograph, so every
 * entry below was read off the images instead:
 *
 *   - `…-casual-shirt-cream` from Indoprimo is a beige *pinstripe*, and reads
 *     as business rather than casual. Listed as a formal stripe.
 *   - `…-casual-shirt-peach` from Manspire is a dusty mauve/pink, not peach.
 *   - `…-striped-casual-shirt-grey` from UV Wholesale is a *sage green* and
 *     white stripe. Calling it grey would contradict the photograph.
 *   - `…-formal-shirt-blue` from Louis Philippe is a light blue *glen check*,
 *     not a solid.
 *   - `…-formal-shirt-green` from Louis Philippe is a deep bottle green.
 *   - `…-formal-shirt-blue` from The Dapperman has a contrast *white collar
 *     and cuffs*, which is the detail a customer actually buys it for.
 *   - `…-shirt-black` from Highlander and `…-party-shirt-olive` from Snitch
 *     are sateen shirts with no chest-pocket styling cues that read as strictly
 *     formal; they are titled as smart/occasion shirts, still inside the
 *     Formal Shirts collection.
 *
 * `pattern` drives the tags and the copy, which is why it is stated per
 * garment rather than inferred from the folder name.
 */

export const MEN_FORMAL_SHIRTS_DIR = 'men-formal-shirts';

/** The two permitted price points for this range. */
const PRICE_POINTS = [100, 149];

/**
 * Shirt sizing. The storefront's existing menswear is jeans, which carries
 * waist sizes (28-36) — a measurement that means nothing on a shirt — so this
 * range uses the alpha sizing shirts are actually sold in, matching the
 * womenswear convention in `women-shorts-skirts.mjs`.
 */
const SIZES = ['S', 'M', 'L', 'XL'];

/**
 * One entry per source folder.
 *
 * `hero` names the thumbnail shot — a frame that shows the whole shirt. Where
 * a folder's `-front.jpg` is cropped at the chest, a wider frame is chosen
 * instead, so the product card is not a close-up of a collar.
 *
 * `colour` is what the photograph shows. `pattern` is solid, striped, checked
 * or textured, read off the weave rather than the filename.
 */
const SHIRTS = [
  {
    dir: 'ad-by-arvind-ad-by-arvind-cutaway-collar-solid-cotton-formal-shirt-grey',
    title: 'Cutaway Collar Solid Formal Shirt',
    hero: 'ad-by-arvind-ad-by-arvind-cutaway-collar-solid-cotton-formal-shirt-grey-front.jpg',
    colour: 'Grey',
    pattern: 'solid',
    fit: 'regular fit',
    collar: 'cutaway collar',
    material: 'Cotton',
    occasion: 'Formal',
    price: 149,
  },
  {
    dir: 'highlander-highlander-men-slim-fit-shirt-black',
    title: 'Slim Fit Sateen Shirt',
    // `-front.jpg` is cropped at the chest; `-6` shows the whole shirt.
    hero: 'highlander-highlander-men-slim-fit-shirt-black-6.jpg',
    colour: 'Black',
    pattern: 'solid',
    fit: 'slim fit',
    collar: 'spread collar',
    material: 'Cotton Blend',
    occasion: 'Business',
    price: 100,
  },
  {
    dir: 'indoprimo-indoprimo-men-cotton-standard-striped-casual-shirt-cream',
    // A beige pinstripe, not the "casual" the folder name claims.
    title: 'Pinstripe Formal Shirt',
    hero: 'indoprimo-indoprimo-men-cotton-standard-striped-casual-shirt-cream-front.jpg',
    colour: 'Beige',
    pattern: 'striped',
    fit: 'regular fit',
    collar: 'spread collar',
    material: 'Cotton',
    occasion: 'Formal',
    price: 100,
  },
  {
    dir: 'invictus-invictus-men-easy-care-grey-black-self-design-formal-shirt',
    title: 'Self Design Textured Formal Shirt',
    hero: 'invictus-invictus-men-easy-care-grey-black-self-design-formal-shirt-front.jpg',
    colour: 'Grey',
    pattern: 'textured',
    fit: 'slim fit',
    collar: 'cutaway collar',
    material: 'Cotton Blend',
    occasion: 'Business',
    price: 149,
  },
  {
    dir: 'louis-philippe-louis-philippe-self-design-slim-fit-pure-cotton-formal-shirt-blue',
    // A glen check, not the solid the folder name implies.
    title: 'Slim Fit Checked Formal Shirt',
    hero: 'louis-philippe-louis-philippe-self-design-slim-fit-pure-cotton-formal-shirt-blue.jpg',
    colour: 'Light Blue',
    pattern: 'checked',
    fit: 'slim fit',
    collar: 'spread collar',
    material: 'Cotton',
    occasion: 'Formal',
    price: 149,
  },
  {
    dir: 'louis-philippe-louis-philippe-slim-fit-pure-cotton-formal-shirt-green',
    title: 'Slim Fit Solid Formal Shirt',
    hero: 'louis-philippe-louis-philippe-slim-fit-pure-cotton-formal-shirt-green-front.jpg',
    colour: 'Bottle Green',
    pattern: 'solid',
    fit: 'slim fit',
    collar: 'spread collar',
    material: 'Cotton',
    occasion: 'Formal',
    price: 149,
  },
  {
    dir: 'louis-philippe-men-slim-fit-easy-to-iron-premium-cotton-full-sleeve-formal-shirt',
    title: 'Slim Fit Textured Formal Shirt',
    hero: 'louis-philippe-men-slim-fit-easy-to-iron-premium-cotton-full-sleeve-formal-shirt.jpg',
    colour: 'White',
    pattern: 'textured',
    fit: 'slim fit',
    collar: 'cutaway collar',
    material: 'Cotton',
    occasion: 'Formal',
    price: 149,
  },
  {
    dir: 'manspire-manspire-men-casual-shirt-peach',
    // The photograph is a dusty mauve, not the peach the folder name claims.
    title: 'Comfort Fit Solid Shirt',
    hero: 'manspire-manspire-men-casual-shirt-peach-front.jpg',
    colour: 'Mauve',
    pattern: 'solid',
    fit: 'comfort fit',
    collar: 'spread collar',
    material: 'Cotton Blend',
    occasion: 'Office',
    price: 100,
  },
  {
    dir: 'raymond-raymond-pure-cotton-slim-fit-formal-shirt-white',
    title: 'Slim Fit Solid Formal Shirt',
    hero: 'raymond-raymond-pure-cotton-slim-fit-formal-shirt-white-front.jpg',
    colour: 'White',
    pattern: 'solid',
    fit: 'slim fit',
    collar: 'spread collar',
    material: 'Cotton',
    occasion: 'Formal',
    price: 149,
  },
  {
    dir: 'raymond-raymond-textured-slim-fit-pure-cotton-formal-shirt-grey',
    title: 'Textured Slim Fit Formal Shirt',
    hero: 'raymond-raymond-textured-slim-fit-pure-cotton-formal-shirt-grey-front.jpg',
    colour: 'Light Grey',
    pattern: 'textured',
    fit: 'slim fit',
    collar: 'spread collar',
    material: 'Cotton',
    occasion: 'Business',
    price: 149,
  },
  {
    dir: 'snitch-snitch-men-slim-fit-party-shirt-olive',
    title: 'Slim Fit Sateen Occasion Shirt',
    hero: 'snitch-snitch-men-slim-fit-party-shirt-olive-front.jpg',
    colour: 'Olive',
    pattern: 'solid',
    fit: 'slim fit',
    collar: 'spread collar',
    material: 'Polyester Blend',
    occasion: 'Business',
    price: 100,
  },
  {
    dir: 'the-dapperman-the-dapperman-men-comfort-formal-shirt-blue',
    // Contrast white collar and cuffs — the detail the shirt is bought for.
    title: 'Contrast Collar Comfort Formal Shirt',
    hero: 'the-dapperman-the-dapperman-men-comfort-formal-shirt-blue-front.jpg',
    colour: 'Sky Blue',
    pattern: 'textured',
    fit: 'comfort fit',
    collar: 'contrast white collar',
    material: 'Cotton',
    occasion: 'Formal',
    price: 149,
  },
  {
    dir: 'uv-wholesale-uv-wholesale-men-comfort-striped-casual-shirt-grey',
    // Sage green and white, not the grey the folder name claims.
    title: 'Comfort Fit Striped Shirt',
    hero: 'uv-wholesale-uv-wholesale-men-comfort-striped-casual-shirt-grey-front.jpg',
    colour: 'Sage Green',
    pattern: 'striped',
    fit: 'comfort fit',
    collar: 'spread collar',
    material: 'Cotton',
    occasion: 'Office',
    price: 100,
  },
  {
    dir: 'van-heusen-van-heusen-iq-men-ultralight-breathable-coolmax-fiber-shirts-white',
    title: 'Ultralight Breathable Formal Shirt',
    hero: 'van-heusen-van-heusen-iq-men-ultralight-breathable-coolmax-fiber-shirts-white.jpg',
    colour: 'White',
    pattern: 'solid',
    fit: 'slim fit',
    collar: 'cutaway collar',
    material: 'Polyester Blend',
    occasion: 'Business',
    price: 149,
  },
];

const BRAND_OVERRIDES = {
  'ad-by-arvind': 'AD by Arvind',
  'louis-philippe': 'Louis Philippe',
  'the-dapperman': 'The Dapperman',
  'uv-wholesale': 'UV Wholesale',
  'van-heusen': 'Van Heusen',
  highlander: 'Highlander',
  indoprimo: 'Indoprimo',
  invictus: 'Invictus',
  manspire: 'Manspire',
  raymond: 'Raymond',
  snitch: 'Snitch',
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

/**
 * Strips the duplicated brand prefix: `raymond-raymond-x` → `raymond`.
 *
 * Most folders repeat the brand, but not all — `louis-philippe-men-slim-fit-…`
 * states it once, and taking the first token alone would brand that shirt
 * "Louis". So a known multi-word brand is matched first, and the duplicate
 * check only runs when none applies.
 */
const MULTI_WORD_BRANDS = [
  'ad-by-arvind',
  'louis-philippe',
  'the-dapperman',
  'uv-wholesale',
  'van-heusen',
];

const brandSlugOf = (dir) => {
  const known = MULTI_WORD_BRANDS.find((brand) => dir.startsWith(`${brand}-`));

  if (known !== undefined) {
    return known;
  }

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

/** Builds variants across the shirt sizes, with deterministic per-size stock. */
const buildVariants = (slug, colour) =>
  SIZES.map((size) => {
    // Every size carries stock: a fixed-price range with sold-out sizes reads
    // as a broken listing rather than a deliberate one.
    const quantity = pick(`${slug}:${size}:qty`, 6, 24);

    return { size, color: colour, quantity, stock: 'in_stock' };
  });

/** The pattern clause used in the description, empty for a plain solid. */
const patternClause = (pattern) => {
  switch (pattern) {
    case 'striped':
      return 'a refined stripe';
    case 'checked':
      return 'a subtle check';
    case 'textured':
      return 'a self-textured weave';
    default:
      return 'a clean solid finish';
  }
};

/**
 * Reads the men's formal shirt folder into product records shaped like those
 * from `readWomenShortsSkirts`, so `seed-men-formal-shirts.mjs` can consume
 * them with the same field mapping.
 */
export const readMenFormalShirts = () => {
  if (!existsSync(MEN_FORMAL_SHIRTS_DIR)) {
    throw new Error(`Source folder not found: ${MEN_FORMAL_SHIRTS_DIR}`);
  }

  const seenSlugs = new Set();
  const seenSkus = new Set();

  return SHIRTS.map((shirt) => {
    const dir = path.join(MEN_FORMAL_SHIRTS_DIR, shirt.dir);

    if (!existsSync(dir)) {
      throw new Error(`Source folder not found: ${dir}`);
    }

    const files = readdirSync(dir).filter((file) => /\.(jpe?g|png|webp)$/i.test(file));

    if (files.length === 0) {
      throw new Error(`No usable images in ${dir}`);
    }

    if (!files.includes(shirt.hero)) {
      throw new Error(`Hero image ${shirt.hero} is missing from ${dir}`);
    }

    if (!PRICE_POINTS.includes(shirt.price)) {
      throw new Error(`${shirt.dir}: price ${String(shirt.price)} is not a permitted price`);
    }

    const brandSlug = brandSlugOf(shirt.dir);
    const brand = BRAND_OVERRIDES[brandSlug] ?? titleCase(brandSlug.replace(/-/g, ' '));

    // "men-" prefixed so the slug reads as menswear even out of context, and
    // the colour keeps two same-titled shirts from the same brand apart.
    const slug = `men-${brandSlug}-${shirt.title}-${shirt.colour}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (seenSlugs.has(slug)) {
      throw new Error(`Duplicate slug generated: ${slug}`);
    }

    seenSlugs.add(slug);

    // MFS = Men Formal Shirt. Hashed from the slug, so it is stable across runs
    // and cannot collide with the YV-<brand> SKUs the main catalogue uses.
    const sku = `YV-MFS-${String(hash(slug) % 100000).padStart(5, '0')}`;

    if (seenSkus.has(sku)) {
      throw new Error(`Duplicate SKU generated: ${sku}`);
    }

    seenSkus.add(sku);

    const title = `${shirt.title} — ${shirt.colour}`;
    const shots = orderShots(files, shirt.hero);

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
      subtitle: `${brand} · ${shirt.material} Shirt`,
      ribbon: newArrival ? 'New In' : topSelling ? 'Bestseller' : null,
      description:
        `${title} by ${brand}. ` +
        `A full-sleeve ${shirt.fit} shirt with a ${shirt.collar} and ` +
        `${patternClause(shirt.pattern)} in ${shirt.colour.toLowerCase()} ` +
        `${shirt.material.toLowerCase()}, cut for office wear, meetings and smart ` +
        'everyday styling. Machine washable. Model is 6\'0" and wears a size M.',

      price: shirt.price,
      // Fixed-price range: the sticker price is the price paid.
      discountPrice: null,
      sku,
      weightGrams: pick(`${slug}:weight`, 180, 320),

      category: 'men',
      gender: 'Men',
      brand,
      collection: 'Formal Shirts',
      season: choose(`${slug}:season`, ['Summer', 'All Season']),
      material: shirt.material,
      occasion: shirt.occasion,

      variants: buildVariants(slug, shirt.colour),

      rating: Number((pick(`${slug}:rating`, 38, 49) / 10).toFixed(1)),
      reviewCount: pick(`${slug}:reviews`, 12, 486),

      featured: hash(`${slug}:featured`) % 100 < 45,
      topSelling,
      newArrival,
      trending: hash(`${slug}:trend`) % 100 < 25,

      slug,
      metaTitle: `${title} for Men | Yarnvia`,
      metaDescription:
        `Shop the ${brand} ${title.toLowerCase()} at Yarnvia. ` +
        `A ${shirt.fit} full-sleeve ${shirt.pattern} shirt for office wear, ` +
        'business meetings and smart everyday styling. Free delivery and easy 7-day returns.',

      // Alt text describes the garment, so it stands alone for a screen reader.
      alt:
        `Men's ${shirt.colour.toLowerCase()} ${shirt.pattern} full sleeve ` +
        `${shirt.fit} formal shirt with a ${shirt.collar}`,

      tags: [
        'men',
        'formal-shirt',
        'office-wear',
        'business',
        shirt.pattern,
        `brand:${brandSlug}`,
        `color:${shirt.colour.toLowerCase().replace(/ /g, '-')}`,
        'stock:in',
        shirt.fit.replace(/ /g, '-'),
        shirt.occasion.toLowerCase(),
      ],
    };
  });
};
