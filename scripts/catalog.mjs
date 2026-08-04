import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Derives structured product records from the source photography filenames.
 *
 * Filenames follow `<brand>-<brand>-<description>-<colour>-<n>.jpg` with the
 * brand slug duplicated. Brand, colour, fabric, fit and weave are all
 * recoverable from that string, so nothing about a product is invented except
 * commercial values no filename can carry — price, stock, rating, review count
 * — which are derived deterministically from the slug so repeated runs produce
 * identical data instead of drifting.
 *
 * To add a category, drop the images in a folder and add a SOURCES entry.
 */

/** Colour tokens, longest first so "navy-blue" beats "blue". */
const COLOURS = [
  'navy-blue',
  'off-white',
  'turquoise',
  'maroon',
  'multi',
  'black',
  'white',
  'orange',
  'green',
  'khaki',
  'beige',
  'cream',
  'brown',
  'olive',
  'grey',
  'rust',
  'pink',
  'blue',
  'red',
  'purple',
  'yellow',
  'gold',
];

/** Trailing tokens that describe the shot rather than the product. */
const VIEW_TOKENS = ['side', 'front', 'back'];

/** Brands whose display name does not survive naive title casing. */
const BRAND_OVERRIDES = {
  'h-m': 'H&M',
  'fame-forever-by-lifestyle': 'Fame Forever',
  'united-colors-of-benetton': 'United Colors of Benetton',
};

const TITLE_CASE_EXCEPTIONS = new Set(['and', 'with', 'in', 'of', 'the']);

const SAREE_MATERIALS = [
  'pure georgette',
  'linen blend',
  'dola silk',
  'art silk',
  'pure cotton',
  'georgette',
  'chanderi',
  'cotton',
  'khadi',
  'silk',
  'net',
];

const SAREE_WEAVES = ['kanjivaram', 'kanjeevaram', 'banarasi', 'bandhani', 'chanderi'];

const DENIM_FITS = [
  'relaxed fit',
  'straight fit',
  'regular fit',
  'skinny fit',
  'baggy fit',
  'loose fit',
  'slim fit',
  'jogger',
  'cargo',
];

/**
 * Source folders. Each maps a directory of photography onto a category.
 *
 * `menEligible` lists files that are additionally published under Men. Only
 * flat-lay garment shots with no model and no child-specific styling qualify —
 * a listing that shows a child must never be sold as adult menswear.
 */
export const SOURCES = [
  {
    dir: 'clothes',
    category: 'women',
    gender: 'Women',
    noun: 'Saree',
    sizes: ['Free Size'],
    materials: SAREE_MATERIALS,
    accents: SAREE_WEAVES,
    defaultMaterial: 'Woven Blend',
    defaultCollection: 'Everyday Drapes',
    occasions: ['Wedding', 'Festive', 'Party', 'Casual'],
    seasons: ['Festive', 'Summer', 'All Season'],
    detail: 'Comes with an unstitched blouse piece. Drape length 5.5 m, blouse 0.8 m.',
    menEligible: [],
  },
  {
    dir: 'children',
    category: 'children',
    gender: 'Boys',
    noun: 'Jeans',
    sizes: ['5-6Y', '7-8Y', '9-10Y', '11-12Y', '13-14Y'],
    materials: ['cotton'],
    accents: DENIM_FITS,
    defaultMaterial: 'Denim',
    defaultCollection: 'Everyday Denim',
    occasions: ['Casual', 'Everyday', 'School'],
    seasons: ['All Season'],
    detail: 'Machine washable. Adjustable inner waistband for a comfortable fit.',
    menEligible: [
      'united-colors-of-benetton-united-colors-of-benetton-boys-slim-fit-mid-rise-jeans.jpg',
      'urbano-juniors-urbano-juniors-boys-black-slim-fit-mid-rise-clean-look-jeans-6.jpg',
      'urbano-juniors-urbano-juniors-boys-navy-blue-solid-slim-fit-stretchable-jeans.jpg',
      'killer-killer-boys-jogger-low-rise-mildly-distressed-heavy-fade-stretchable-back.jpg',
    ],
  },
];

/** Adult waist sizes for the cross-listed menswear. */
const MEN_SIZES = ['28', '30', '32', '34', '36'];

/** Stable 32-bit hash so every derived value is reproducible across runs. */
const hash = (value) => parseInt(createHash('sha1').update(value).digest('hex').slice(0, 8), 16);

const pick = (seed, min, max) => min + (hash(seed) % (max - min + 1));

const choose = (seed, list) => list[hash(seed) % list.length];

const titleCase = (value) =>
  value
    .split(' ')
    .filter((word) => word !== '')
    .map((word, index) =>
      index > 0 && TITLE_CASE_EXCEPTIONS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');

/** Strips the duplicated brand prefix: `kalini-kalini-x` → brand `kalini`, rest `x`. */
const splitBrand = (stem) => {
  const parts = stem.split('-');

  for (let size = Math.floor(parts.length / 2); size >= 1; size -= 1) {
    if (parts.slice(0, size).join('-') === parts.slice(size, size * 2).join('-')) {
      return { brandSlug: parts.slice(0, size).join('-'), rest: parts.slice(size * 2) };
    }
  }

  return { brandSlug: parts[0], rest: parts.slice(1) };
};

/**
 * Removes trailing shot-index and view tokens, then extracts the colour from
 * anywhere in the remaining tokens — filenames place it at the end for sarees
 * but mid-string for denim ("boys-navy-blue-solid-slim-fit").
 */
const extractColour = (tokens) => {
  const working = [...tokens];

  while (working.length > 0) {
    const last = working[working.length - 1];

    if (/^\d+$/.test(last) || VIEW_TOKENS.includes(last)) {
      working.pop();
      continue;
    }
    break;
  }

  for (const colour of COLOURS) {
    const parts = colour.split('-');

    for (let start = working.length - parts.length; start >= 0; start -= 1) {
      if (working.slice(start, start + parts.length).join('-') === colour) {
        return {
          colour,
          tokens: [...working.slice(0, start), ...working.slice(start + parts.length)],
        };
      }
    }
  }

  return { colour: null, tokens: working };
};

const findFirst = (haystack, needles) => needles.find((n) => haystack.includes(n)) ?? null;

/** Builds variants across the given sizes, with deterministic per-size stock. */
const buildVariants = (slug, sizes, colour) =>
  sizes.map((size) => {
    const quantity = pick(`${slug}:${size}:qty`, 0, 24);

    return {
      size,
      color: colour === null ? 'Multi' : titleCase(colour.replace(/-/g, ' ')),
      quantity,
      stock: quantity > 0 ? 'in_stock' : 'out_of_stock',
    };
  });

/**
 * Builds one product record.
 *
 * @param asMen When true, publishes the same photograph under Men with adult
 *   waist sizes and the "boys" qualifier removed from the copy.
 */
const buildProduct = (filename, source, asMen = false) => {
  const stem = path.basename(filename, path.extname(filename));
  const { brandSlug, rest } = splitBrand(stem);
  const { colour, tokens: colourless } = extractColour(rest);

  // "boys" is a categorisation, not a product attribute — drop it for menswear.
  const tokens = asMen ? colourless.filter((token) => token !== 'boys') : colourless;

  const descriptor = tokens.join(' ');
  const brand = BRAND_OVERRIDES[brandSlug] ?? titleCase(brandSlug.replace(/-/g, ' '));
  const material = findFirst(descriptor, source.materials);
  const accent = findFirst(descriptor, source.accents);

  const noun = source.noun;
  const hasNoun = descriptor.includes(noun.toLowerCase());
  const baseTitle = titleCase(
    `${descriptor.replace(/\bsarees\b/, 'saree')}${hasNoun ? '' : ` ${noun.toLowerCase()}`}`,
  );

  const title =
    colour === null ? baseTitle : `${baseTitle} — ${titleCase(colour.replace(/-/g, ' '))}`;

  const slugBase = `${brandSlug}-${tokens.join('-')}${colour === null ? '' : `-${colour}`}`
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const slug = asMen ? `${slugBase}-men` : slugBase;

  // File key drives the Cloudinary public_id, so a cross-listed photograph is
  // uploaded once and referenced by both product rows.
  const fileKey = `${brandSlug}-${colourless.join('-')}${colour === null ? '' : `-${colour}`}`
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const price = pick(`${slug}:price`, 30, 179) * 50 + 49;
  const discountPct = pick(`${slug}:discount`, 15, 62);
  const discountPrice = Math.round((price * (100 - discountPct)) / 100 / 10) * 10 - 1;

  const sizes = asMen ? MEN_SIZES : source.sizes;
  const variants = buildVariants(slug, sizes, colour);
  const inStock = variants.some((variant) => variant.stock === 'in_stock');

  const topSelling = hash(`${slug}:top`) % 100 < 40;
  const newArrival = hash(`${slug}:new`) % 100 < 30;

  const materialLabel = titleCase(material ?? source.defaultMaterial);

  return {
    sourceFile: filename,
    sourceDir: source.dir,
    fileKey,

    title,
    subtitle: `${brand} · ${materialLabel} ${noun}`,
    ribbon: newArrival
      ? 'New In'
      : topSelling
        ? 'Bestseller'
        : discountPct >= 50
          ? 'Limited Deal'
          : null,
    description:
      `${title} by ${brand}. ` +
      `Made in ${materialLabel.toLowerCase()}${accent === null ? '' : ` with a ${accent} silhouette`}. ` +
      source.detail,

    price,
    discountPrice,
    sku: `YV-${brandSlug.slice(0, 3).toUpperCase()}-${String(hash(slug) % 100000).padStart(5, '0')}`,
    weightGrams: pick(`${slug}:weight`, 300, 1100),

    category: asMen ? 'men' : source.category,
    gender: asMen ? 'Men' : source.gender,
    brand,
    collection: accent === null ? source.defaultCollection : `${titleCase(accent)} Edit`,
    season: choose(`${slug}:season`, source.seasons),
    material: materialLabel,
    occasion: choose(`${slug}:occasion`, source.occasions),

    variants,

    rating: Number((pick(`${slug}:rating`, 36, 49) / 10).toFixed(1)),
    reviewCount: pick(`${slug}:reviews`, 8, 476),

    featured: hash(`${slug}:featured`) % 100 < 45,
    topSelling,
    newArrival,
    trending: hash(`${slug}:trend`) % 100 < 25,

    slug,
    metaTitle: `${title} | Yarnvia`,
    metaDescription:
      `Shop the ${title} by ${brand} at Yarnvia. ` +
      `${materialLabel} ${noun.toLowerCase()}. Free delivery and easy 7-day returns.`,

    tags: [
      noun.toLowerCase(),
      `brand:${brandSlug}`,
      colour === null ? null : `color:${colour}`,
      inStock ? 'stock:in' : 'stock:out',
      material === null ? null : `material:${material.replace(/ /g, '-')}`,
      accent === null ? null : accent.replace(/ /g, '-'),
    ].filter((tag) => tag !== null),
  };
};

/** Parses every configured source folder into product records. */
export const readCatalog = () => {
  const products = [];

  for (const source of SOURCES) {
    const files = readdirSync(source.dir)
      .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
      .sort();

    for (const file of files) {
      products.push(buildProduct(file, source));

      if (source.menEligible.includes(file)) {
        products.push(buildProduct(file, source, true));
      }
    }
  }

  return products;
};
