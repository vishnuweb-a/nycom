# Yarnvia Changelog

Append-only. Newest entries at the bottom. Never overwrite a previous entry.

---

## 2026-08-04 — Phase 0 (Project Initialization) + Phase 1 (Design System)

### Task

Stand up the React + TypeScript + Vite + Tailwind toolchain, the folder architecture, routing, and
the complete design-token layer. No feature UI.

### Files Added

**Build & tooling**

- `package.json` — dependencies and the dev/build/lint/typecheck/format scripts
- `vite.config.ts` — Tailwind v4 plugin, `@/` alias, vendor chunk splitting
- `tsconfig.app.json` — strict mode plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`; `@/*` path alias
- `eslint.config.js` — type-aware ESLint 9 flat config with `jsx-a11y` strict, react-hooks,
  react-refresh, `no-console`, enforced `@/` imports
- `.prettierrc.json`, `.prettierignore` — formatting with automatic Tailwind class ordering
- `.gitignore`, `.gitattributes`, `.env.example`, `vercel.json`, `README.md`, `index.html`,
  `public/favicon.svg`

**Application**

- `src/styles/global.css` — the design system (`@theme` tokens, base layer, shared utilities)
- `src/main.tsx`, `src/App.tsx`
- `src/router/AppRouter.tsx`, `src/router/RouteErrorBoundary.tsx`
- `src/layouts/MainLayout/` — landmark shell and skip link
- `src/constants/routes.ts`, `src/constants/app.ts`
- `src/lib/env.ts` — Zod-validated client environment
- `src/utils/cn.ts` — class merger configured against the custom token scales
- `src/pages/{Home,Shop,Product,Cart,Checkout,OrderSuccess,Orders,Contact}/` — structural shells
- `src/pages/NotFound/` — fully implemented 404

### Files Modified

- `.env` — renamed client variables to the `VITE_` prefix required by Vite; segregated and
  annotated the server-only credentials; added the missing `VITE_CLOUDINARY_UPLOAD_PRESET`
- `docs/architecture.md`, `docs/design.md`, `docs/guildline.md` — synchronized with the decisions
  recorded below

### Summary

The application boots, builds and lints clean. Every route is code-split, every page resolves, and
all visual tokens from `design.md` are available as Tailwind utilities.

### Reason

`phases.md` requires Phase 0 and Phase 1 to complete before feature work. Phase 1 was delivered
alongside Phase 0 because CSS-first Tailwind v4 makes the token layer inseparable from the build
configuration — there is no meaningful "Tailwind configured" state that excludes the tokens.

### Decisions

1. **Tailwind v4, CSS-first.** Tokens live in one `@theme` block; no `tailwind.config.js`. Aligns
   with the three v4 skills in `.agents/skills` and makes future dark mode a variable swap.
2. **Default scales reset to `initial`.** Color, typography, radius, shadow, breakpoint and
   container scales are cleared before the design tokens are declared, so `bg-blue-500` or
   `text-xs` generate no CSS at all and render visibly unstyled. Verified by probe: Tailwind does
   **not** error on unknown utilities, so this is a loud safety net for
   "never invent new colors/spacing/typography", not a hard build gate.
3. **Body size tokens named `base`/`lg`, not `body`.** `--text-body` and `--color-body` would both
   compile to a `text-body` utility, making it ambiguous.
4. **ESLint over oxlint.** Vite 8 now scaffolds oxlint, but `phases.md` specifies ESLint and
   `eslint-plugin-jsx-a11y` is materially more complete — WCAG AA is a hard requirement.
5. **ESLint pinned to v9.** `eslint-plugin-jsx-a11y@6.10.2` does not yet support ESLint 10.
   Pinning was chosen over `--legacy-peer-deps`, which would have produced a knowingly broken tree.
6. **Brand/Color/Availability filters via namespaced tags.** Per the project owner's decision, these
   are encoded as `brand:levis`, `color:navy`, `stock:in` inside the existing `tags` array rather
   than as new columns. Parsing will be confined to a single typed facet utility so components never
   touch raw strings and a future column migration is a one-file change.
7. **Header composition.** Logo, primary nav (Home / Shop / My Orders), search, Wishlist, Cart,
   Profile. "Become Seller" from `design.md` is omitted — no vendor feature exists in the PRD.
8. **Self-hosted Inter** via `@fontsource-variable/inter` rather than the Google Fonts CDN, removing
   a third-party origin from the critical path.
9. **`/order-success` route added.** Required by `prd.md` §12 but absent from the `architecture.md`
   routing table.

### Validation Performed

- `npm run build` — passes; TypeScript strict clean; 10 route chunks emitted; `react-vendor`
  isolated at 88.4 kB gzip
- `npm run lint` — zero errors, zero warnings
- `npx prettier --check .` — clean
- Production preview served; `/` and the deep route `/orders` both return 200

Not yet verified: visual rendering in a browser, and any Supabase or Cloudinary connectivity (no
service layer exists yet).

### Future Notes

- `VITE_CLOUDINARY_UPLOAD_PRESET` is empty. An **unsigned** preset scoped to `yarnvia/` must be
  created in the Cloudinary dashboard before any browser-side upload work.
- `SUPABASE_SERVICE_ROLE` and `CLOUDINARY_API_SECRET` sat in a plaintext, previously un-ignored
  `.env`. Rotating both is recommended.
- The eight page shells carry a single heading each and are filled in during Phases 4–9.
- Pin ESLint back to `^10` once `eslint-plugin-jsx-a11y` adds support.

### Next Recommended Phase

Phase 2 — Core Layout (Header, category navigation, search bar, footer, container/section wrappers,
mobile bottom navigation).

---

## 2026-08-04 — Phase 2 (Core Layout)

### Feature

The application shell: header, category navigation, search, footer and mobile bottom navigation,
composed into `MainLayout` so every route renders Header → Content → Footer.

### Files Created

**Components**

- `components/buttons/Button/` — `Button.tsx`, `buttonVariants.ts`, `index.ts`
- `components/common/Container/` — page gutters and the 1320px content column
- `components/common/Section/` — titled page band, labelled as a landmark
- `components/common/Logo/` — inline SVG wordmark with an inverted variant
- `components/common/Breadcrumb/` — trail with the current crumb unlinked
- `components/common/SearchBar/` — search form navigating to `/shop?q=`
- `components/layout/Header/` — `Header.tsx`, `CartLink.tsx`
- `components/layout/CategoryNav/` — 52px category bar
- `components/layout/Footer/` — dark footer with link columns, social and copyright
- `components/layout/MobileBottomNav/` — sticky bottom bar, hidden from tablet up

**Constants and types**

- `constants/categories.ts`, `constants/navigation.ts`, `constants/search.ts`
- `types/navigation.ts`

### Files Modified

- `layouts/MainLayout/MainLayout.tsx` — composes the full chrome
- `pages/NotFound/NotFoundPage.tsx` — now uses `Container` and `buttonVariants`
- `router/RouteErrorBoundary.tsx` — now uses `Container`, `Button` and `buttonVariants`
- `docs/architecture.md`, `docs/design.md`, `docs/phases.md` — synchronized

### Summary

Every page now carries the full application chrome, responsive across all five breakpoints. All
navigation is table-driven from `constants/`; no route string or category name is inlined in a
component. The button styling previously duplicated between the 404 page and the route error
boundary is now a single primitive.

### Notes

**Scope amendments** — `Button` was pulled forward from Phase 3 because five call sites needed it.
Newsletter and Query Form moved to Phase 4, where their handlers exist; they have no data path until
Phase 10 and building them now would have required a stub. `MobileBottomNav` was added; it is
required by `design.md` but was missing from the Phase 2 list.

**Removed before commit** — `Input`, `Textarea` and `IconButton` were built, then deleted once the
forms moved to Phase 4 left them without consumers. Unused components are dead code.

**Deliberate omissions** — Wishlist, Account, the cart count badge and "Become Seller" are not
rendered. No feature or route exists behind any of them; each ships with its feature. See the
omissions table in `architecture.md`.

**Social links render as text.** `lucide-react` 1.x removed all brand icons for trademark reasons.
Hand-authoring brand SVG paths was rejected as unreliable. Brand marks need an approved icon
dependency.

**Open PRD gap.** `prd.md` §16 requires About, Privacy Policy, Terms, Refund Policy and FAQs in the
footer, but §5 defines no routes for them and no phase builds them. They are omitted rather than
linked to 404s. This needs a decision: add static content routes, or drop them from §16.

### Validation Performed

- `npm run build` — passes, TypeScript strict clean
- `npm run lint` — zero errors, zero warnings
- `npx prettier --check .` — clean
- Grepped the emitted CSS to confirm all 14 design-token utilities used by the new chrome generate
  real rules — `h-header`, `h-nav`, `size-tap`, `max-w-searchbar`, `bg-footer`, `bg-search`,
  `text-caption`, `rounded-pill`, `h-control` and others

Not verified: rendering in a browser, and behaviour at each breakpoint on a real device.

### Next Recommended Phase

Phase 3 — Reusable Components (Input, Textarea, Dropdown, Modal, Drawer, Accordion, Badge, Loader,
Skeleton, Pagination, Product Card, Category Card, Rating Badge, Price, Quantity Selector, Empty
State, Toast). `Button` is already delivered.

---

## 2026-08-04 — Feature 1: Home

### Feature

The complete landing page from `prd.md` §7 — hero carousel, shop by category, featured products, top
selling, why shop with us, and newsletter signup — backed by Supabase and Cloudinary, with loading,
empty and error states on every data-driven section.

### Files Created

**Database and seeding**

- `supabase/migrations/0001_init.sql` — `products` (all 32 specified fields), `categories`,
  `carousel`, `newsletter_subscribers`, `contact_queries`; indexes, an `updated_at` trigger, RLS
  policies, and the three seed categories
- `scripts/catalog.mjs` — derives structured products from the source photography filenames
- `scripts/seed.mjs` — uploads to Cloudinary and upserts the catalogue into Supabase

**Data layer**

- `lib/supabase.ts`, `services/products.ts`, `services/categories.ts`, `services/carousel.ts`,
  `services/newsletter.ts`
- `types/product.ts`, `types/category.ts`, `types/carousel.ts`
- `hooks/useAsyncData.ts`, `utils/cloudinary.ts`, `utils/format.ts`

**Components**

- `components/product/ProductCard/`, `components/product/ProductCardSkeleton/`
- `components/cards/CategoryCard/`, `components/common/StatusMessage/`
- `pages/Home/sections/` — `HeroCarousel`, `CategoryStrip`, `ProductShowcase`, `WhyYarnvia`,
  `Newsletter`

### Files Modified

- `pages/Home/HomePage.tsx` — composes the sections
- `vite.config.ts` — isolates the Supabase client into its own cached chunk

### Summary

The homepage renders entirely from Supabase. Each section fetches independently, so one failing
query degrades a single rail rather than blanking the page. Images are served from Cloudinary with
`f_auto,q_auto,dpr_auto` and a responsive `srcset`, so one stored 1080×1440 original serves the
hero, the cards and the category chips without re-uploading.

Catalogue data is derived from the 22 source filenames, which encode brand, colour, fabric and
weave. Nothing about a product is invented except values no filename can carry — price, stock,
rating and review count — which are derived deterministically from the slug so re-seeding produces
identical data rather than drifting.

### Validation

- `npm run build` — passes, TypeScript strict clean. Home route chunk 23.95 kB gzip; Supabase
  isolated at 53.38 kB gzip and shared across every future data route
- `npm run lint` — zero errors, zero warnings
- `npx prettier --check .` — clean
- Catalogue parser dry-run: 22 products, 22 unique slugs, 22 unique SKUs, 7 featured, 9 top selling,
  1 deliberately out of stock to exercise the sold-out treatment

Not yet verified: the seeded homepage in a browser. The migration had not been applied at the time
of writing, so no data has been inserted and no image has been uploaded.

### Notes

**One manual step outstanding.** `supabase/migrations/0001_init.sql` must be run in the Supabase SQL
Editor before `npm run seed` will do anything — PostgREST cannot execute DDL and the project has no
Postgres password on file. The seed script detects the missing table and exits with instructions
rather than failing obscurely.

**Catalogue is women's sarees only.** All 22 source images are sarees. Per the project owner, they
seed under Women; Men and Children exist as real categories awaiting their photography and render
honest empty states until then.

**Sizes are "Free Size".** Sarees are not sized XS–XXL. The size filter in `prd.md` §8 will have
little to work with until non-saree stock exists.

**Derived commercial data.** Prices, stock levels, ratings and review counts are generated, not
real. Ratings in particular are fabricated social proof and must be replaced with genuine review
data before this store takes real orders.

**Add to Cart is absent from the product card.** The card is a single link to the product page. The
quick-add action belongs to the Cart feature, which owns the state it mutates; adding a button now
would mean shipping a control that does nothing.

**Contact form deferred.** `prd.md` §7 Section 8 places a contact form on the homepage. Its table
(`contact_queries`) is already created, but the form ships with the Contact feature, which is last
in the agreed feature order.

### Future Notes

- Re-run `npm run seed` after adding Men's and Children's photography to `clothes/`; the script is
  idempotent and will upsert rather than duplicate.
- `VITE_CLOUDINARY_UPLOAD_PRESET` is still empty. It is not needed for the seed script, which signs
  uploads server-side, but browser-side uploads will require it.

---

## 2026-08-04 — Catalogue seeded: children's denim added, Home now live on real data

### Feature

Applied the migration, generalised the catalogue parser to handle multiple garment types, and seeded
the live catalogue. The Home feature is now rendering from real Supabase data with Cloudinary
imagery — the outstanding manual step from the previous entry is closed.

### Files Changed

- `scripts/catalog.mjs` — rewritten around a `SOURCES` table so each folder maps to a category with
  its own vocabulary (fabric, weave, fit) and size scale. Colour extraction now scans the whole
  filename, not just the tail, because denim names place it mid-string
  (`boys-navy-blue-solid-slim-fit`). Adds brand display overrides so `h-m` renders as `H&M`.
- `scripts/seed.mjs` — uploads each photograph once and keys assets by file rather than by product,
  so a cross-listed image is not uploaded twice. Sets covers for all three categories and builds one
  hero slide per category.

### Database Changes

`0001_init.sql` applied. Seeded 38 products from 34 photographs:

| Category | Products | Source                             |
| -------- | -------- | ---------------------------------- |
| Women    | 22       | `clothes/` — sarees                |
| Children | 12       | `children/` — boys' jeans          |
| Men      | 4        | cross-listed from `children/`      |

Also seeded: 3 carousel slides (one per category), cover images on all three categories.

### Cloudinary Changes

34 images uploaded to `yarnvia/products/` with deterministic public IDs.

### Validation

- `npm run build`, `npm run lint`, `prettier --check` — all clean
- Verified with the **public anon key**, not the service role: 22 women / 12 children / 4 men
  readable; 12 featured; 17 top selling; 3 carousel slides; all category covers present
- RLS write probe with the anon key returned **401 Blocked**, confirming the public key cannot write
- Cloudinary transformations verified live: the 245.7 kB JPEG original delivers as a 13.7 kB WebP at
  card size and 4.0 kB at category-chip size — a 94% reduction

### Notes

**Men's category is placeholder data.** The project owner asked for some children's items to be used
in Men. The `children/` folder is mixed: several images show a child model (H&M, Baesd, Dripteen)
and the Stylecast piece has cartoon graphics and a toddler elastic waist. Those were excluded — a
listing showing a child must not be sold as adult menswear.

The four cross-listed items (United Colors of Benetton, both Urbano Juniors, Killer) are flat-lay
denim shots with no person and no child-specific styling. For those rows the "boys" token is dropped
from the title and copy, `gender` is `Men`, and variants use adult waist sizes 28–36 rather than
child age sizes. They share a Cloudinary asset with their Children counterpart but are distinct
product rows with their own slug and SKU.

They remain boys' jeans underneath. **Replace them with genuine men's photography before this store
takes real orders** — the waist sizing is not truthful to the garment.

**Size filtering is now meaningful.** Children carry 5-6Y to 13-14Y and Men carry 28–36, so the Shop
size facet has real values to work with. Sarees remain Free Size.

**Still generated, not real:** prices, stock levels, ratings and review counts across all 38
products.

### Future Notes

- Adding a category is now a `SOURCES` entry plus a folder; re-running `npm run seed` upserts.
- When real men's photography arrives, remove `menEligible` from the children source and seed the
  men's folder as its own `SOURCES` entry.
