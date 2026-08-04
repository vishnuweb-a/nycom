import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Derives structured product records from the source photography filenames.
 *
 * The filenames follow `<brand>-<brand>-<description>-<colour>-<n>.jpg`, with
 * the brand slug duplicated. Everything the catalogue needs — brand, title,
 * colour, material, weave — is recoverable from that string, so nothing about a
 * product is invented except commercial values that no filename can carry
 * (price, stock, rating), which are derived deterministically from the slug so
 * repeated runs produce identical data.
 */

export const SOURCE_DIR = 'clothes';
export const CLOUDINARY_FOLDER = 'yarnvia/products';

/** Colour tokens that may appear at the end of a filename. */
const COLOURS = [
  'off-white',
  'maroon',
  'multi',
  'black',
  'white',
  'orange',
  'green',
  'red',
  'blue',
  'purple',
  'grey',
  'rust',
  'pink',
  'yellow',
  'gold',
  'beige',
  'navy',
  'cream',
];

/** Trailing tokens that describe the shot rather than the product. */
const VIEW_TOKENS = ['side', 'front', 'back'];

/** Fabric and weave vocabulary, longest first so "art silk" beats "silk". */
const MATERIALS = [
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

const WEAVES = ['kanjivaram', 'kanjeevaram', 'banarasi', 'bandhani', 'chanderi'];

const TITLE_CASE_EXCEPTIONS = new Set(['and', 'with', 'in', 'of', 'the']);

/** Stable 32-bit hash so every derived value is reproducible across runs. */
const hash = (value) => parseInt(createHash('sha1').update(value).digest('hex').slice(0, 8), 16);

/** Deterministic integer in [min, max] for a given seed string. */
const pick = (seed, min, max) => min + (hash(seed) % (max - min + 1));

/** Deterministic element choice from a list. */
const choose = (seed, list) => list[hash(seed) % list.length];

const titleCase = (value) =>
  value
    .split(' ')
    .map((word, index) =>
      index > 0 && TITLE_CASE_EXCEPTIONS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');

/**
 * Strips the duplicated brand prefix.
 * `kalini-kalini-ethnic-motifs...` → brand `kalini`, rest `ethnic-motifs...`
 */
const splitBrand = (stem) => {
  const parts = stem.split('-');

  for (let size = Math.floor(parts.length / 2); size >= 1; size -= 1) {
    const head = parts.slice(0, size).join('-');
    const next = parts.slice(size, size * 2).join('-');

    if (head === next) {
      return { brandSlug: head, rest: parts.slice(size * 2) };
    }
  }

  return { brandSlug: parts[0], rest: parts.slice(1) };
};

/** Removes trailing shot-index and view tokens, and extracts the colour. */
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
    const tail = working.slice(-parts.length).join('-');

    if (tail === colour) {
      return { colour, tokens: working.slice(0, working.length - parts.length) };
    }
  }

  return { colour: null, tokens: working };
};

const findFirst = (haystack, needles) => needles.find((n) => haystack.includes(n)) ?? null;

/** Builds one product record from one source filename. */
export const parseProduct = (filename) => {
  const stem = path.basename(filename, path.extname(filename));
  const { brandSlug, rest } = splitBrand(stem);
  const { colour, tokens } = extractColour(rest);

  const descriptor = tokens.join(' ');
  const brand = titleCase(brandSlug.replace(/-/g, ' '));
  const material = findFirst(descriptor, MATERIALS);
  const weave = findFirst(descriptor, WEAVES);

  const baseTitle = titleCase(descriptor.replace(/\bsarees\b/, 'saree'));
  const title =
    colour === null ? baseTitle : `${baseTitle} — ${titleCase(colour.replace('-', ' '))}`;

  const slug = `${brandSlug}-${tokens.join('-')}${colour === null ? '' : `-${colour}`}`
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Commercial values: no filename carries these, so they are derived from the
  // slug. Deterministic, therefore stable across re-seeds.
  const price = pick(`${slug}:price`, 30, 179) * 50 + 49; // ₹1,549 – ₹8,999
  const discountPercent = pick(`${slug}:discount`, 15, 62);
  const discountPrice = Math.round((price * (100 - discountPercent)) / 100 / 10) * 10 - 1;

  const quantity = pick(`${slug}:qty`, 0, 40);
  const rating = (pick(`${slug}:rating`, 36, 49) / 10).toFixed(1);
  const reviewCount = pick(`${slug}:reviews`, 8, 476);

  const featured = hash(`${slug}:featured`) % 100 < 45;
  const topSelling = hash(`${slug}:top`) % 100 < 40;
  const newArrival = hash(`${slug}:new`) % 100 < 30;
  const trending = hash(`${slug}:trend`) % 100 < 25;

  const ribbon = newArrival
    ? 'New In'
    : topSelling
      ? 'Bestseller'
      : discountPercent >= 50
        ? 'Limited Deal'
        : null;

  const tags = [
    'saree',
    `brand:${brandSlug}`,
    colour === null ? null : `color:${colour}`,
    quantity > 0 ? 'stock:in' : 'stock:out',
    material === null ? null : `material:${material.replace(/ /g, '-')}`,
    weave,
  ].filter((tag) => tag !== null);

  return {
    sourceFile: filename,
    publicId: `${CLOUDINARY_FOLDER}/${slug}`,

    title,
    subtitle: `${brand} · ${titleCase(material ?? 'Woven')} Saree`,
    ribbon,
    description:
      `${title} by ${brand}. ` +
      `Crafted in ${material ?? 'a premium woven fabric'}${weave === null ? '' : ` with traditional ${titleCase(weave)} detailing`}. ` +
      `Comes with an unstitched blouse piece. Drape length 5.5 m, blouse 0.8 m.`,

    price,
    discountPrice,
    discountPercent,
    sku: `YV-${brandSlug.slice(0, 3).toUpperCase()}-${String(hash(slug) % 100000).padStart(5, '0')}`,
    weightGrams: pick(`${slug}:weight`, 450, 1100),

    category: 'women',
    gender: 'Women',
    brand,
    collection: weave === null ? 'Everyday Drapes' : `${titleCase(weave)} Edit`,
    season: choose(`${slug}:season`, ['Festive', 'Summer', 'All Season']),
    material: titleCase(material ?? 'Woven Blend'),
    occasion: choose(`${slug}:occasion`, ['Wedding', 'Festive', 'Party', 'Casual']),

    variants: [
      {
        size: 'Free Size',
        color: colour === null ? 'Multi' : titleCase(colour.replace('-', ' ')),
        quantity,
        stock: quantity > 0 ? 'in_stock' : 'out_of_stock',
      },
    ],

    rating: Number(rating),
    reviewCount,

    featured,
    topSelling,
    newArrival,
    trending,

    slug,
    metaTitle: `${title} | Yarnvia`,
    metaDescription:
      `Shop the ${title} by ${brand} at Yarnvia. ` +
      `${material === null ? '' : `${titleCase(material)} saree. `}Free delivery and easy 7-day returns.`,

    tags,
  };
};

/** Parses every source image into a product record. */
export const readCatalog = () =>
  readdirSync(SOURCE_DIR)
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .sort()
    .map(parseProduct);
