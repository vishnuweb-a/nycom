# Yarnvia Architecture

Version: 1.0

---

# Project Overview

## Project Name

Yarnvia

## Project Type

Modern Fashion Ecommerce Website

## Architecture Style

Frontend First Architecture

UI Prototype / MVP

Component Driven

Scalable Folder Structure

Cloud-Based Asset Management

---

# Architecture Philosophy

The goal of this project is NOT to build a complete ecommerce platform.

Instead, the goal is to create a production-quality shopping experience while keeping the backend intentionally lightweight.

Priority Order

1. UI / UX
2. Component Reusability
3. Responsive Design
4. Clean Code
5. Simple Backend
6. Easy Scalability

The architecture should allow additional backend functionality to be added later without requiring major frontend changes.

---

# High Level Architecture

                    User
                      │
                      ▼
              React Frontend
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
     Supabase DB             Cloudinary
          │                       │
          └───────────┬───────────┘
                      ▼
                 Product Data
                      │
                      ▼
                  UI Rendering

---

# Technology Stack

## Frontend

React

TypeScript

Vite

Tailwind CSS

React Router

React Hook Form

Lucide Icons

Framer Motion (optional)

TanStack Query (optional)

Zod (Validation)

---

## Backend

Supabase

Used For

Database

Authentication (Future)

Contact Form Storage

Product Data

Categories

Carousel

Orders (Mock)

---

## Image Storage

Cloudinary

Stores

Product Images

Category Images

Carousel Images

Brand Images

User Uploaded Images

The frontend always consumes Cloudinary Secure URLs.

---

## Deployment

Frontend

Vercel

Database

Supabase

Image CDN

Cloudinary

---

# Application Layers

Presentation Layer

↓

Business Logic Layer

↓

Service Layer

↓

Database Layer

↓

Cloudinary

---

# Frontend Architecture

src/

components/

pages/

layouts/

features/

hooks/

services/

context/

constants/

utils/

types/

assets/

styles/

router/

---

# Folder Structure

src/

│

├── assets/

│ ├── icons/

│ ├── images/

│ └── logos/

│

├── components/

│ ├── common/

│ ├── product/

│ ├── layout/

│ ├── forms/

│ ├── buttons/

│ ├── cards/

│ ├── filters/

│ ├── modal/

│ └── loaders/

│

├── pages/

│ ├── Home/

│ ├── Shop/

│ ├── Product/

│ ├── Cart/

│ ├── Checkout/

│ ├── Orders/

│ ├── Contact/

│ └── NotFound/

│

├── layouts/

│ ├── MainLayout/

│ └── AdminLayout/

│

├── hooks/

│ ├── useCart.ts

│ ├── useProducts.ts

│ ├── useSearch.ts

│ └── useFilters.ts

│

├── services/

│ ├── supabase/

│ ├── cloudinary/

│ ├── products.ts

│ ├── category.ts

│ ├── cart.ts

│ └── contact.ts

│

├── context/

│ ├── CartContext.tsx

│ ├── ThemeContext.tsx

│ └── AuthContext.tsx

│

├── utils/

│ ├── formatter.ts

│ ├── helper.ts

│ ├── validation.ts

│ └── constants.ts

│

├── types/

│ ├── product.ts

│ ├── cart.ts

│ ├── order.ts

│ └── category.ts

│

├── router/

│ └── AppRouter.tsx

│

├── App.tsx

└── main.tsx

---

# Feature Modules

Home

Shop

Product Details

Cart

Checkout

Orders

Contact

Authentication (Future)

Admin (Future)

Wishlist (Future)

Each feature should be isolated.

---

# Layout Architecture

Main Layout

Header

↓

Page Content

↓

Footer

Every page should use the MainLayout.

---

# Routing Structure

/

↓

Home

/shop

↓

All Products

/shop/:category

↓

Category Products

/product/:id

↓

Product Details

/cart

↓

Shopping Cart

/checkout

↓

Checkout

/orders

↓

My Orders

/contact

↓

Contact Form

---

# Shared Components

Navbar

Footer

Button

Input

Search Bar

Product Card

Category Card

Badge

Rating

Pagination

Filter Sidebar

Modal

Toast

Loader

Breadcrumb

Section Header

Newsletter

Query Form

Every component should remain reusable.

---

# State Management

Local State

React useState

Global State

Context API

Cart

Theme

Authentication (Future)

Server State

TanStack Query (Future)

Avoid unnecessary global state.

---

# Data Flow

User

↓

UI

↓

Service

↓

Supabase

↓

Cloudinary URL

↓

React Components

↓

Screen

Business logic should never exist inside UI components.

---

# Database Overview

Supabase

Tables

products

categories

carousel

featured_products

orders

contact_queries

users (Future)

wishlist (Future)

---

# Products Table

id

title

slug

description

category

gender

price

discount_price

rating

sizes

tags

featured

top_selling

image_urls

created_at

updated_at

---

# Categories Table

id

name

slug

description

cover_image

created_at

---

# Carousel Table

id

title

subtitle

image_url

button_text

button_link

display_order

active

---

# Contact Queries Table

id

name

email

phone

subject

message

status

created_at

---

# Orders Table

id

user_id

products

total_price

payment_method

delivery_address

status

created_at

---

# Image Architecture

Cloudinary is the only media provider.

Never store product images inside the project.

Never store product images in Supabase Storage.

Workflow

Admin Upload

↓

Cloudinary Upload

↓

Secure URL Generated

↓

Save URL in Supabase

↓

Frontend Fetches URL

↓

Display Image

---

# Cloudinary Folder Structure

yarnvia/

products/

carousel/

categories/

brands/

avatars/

banners/

future/

Folders should remain organized.

---

# Services Layer

services/

products.ts

Handles product operations

category.ts

Handles category retrieval

cart.ts

Handles cart logic

contact.ts

Handles contact form

cloudinary.ts

Cloudinary helper

supabase.ts

Supabase client

No API logic inside components.

---

# Validation Layer

Use

React Hook Form

-

Zod

Every form should validate

Required Fields

Email

Phone

Minimum Length

Maximum Length

No manual validation unless necessary.

---

# Error Handling

Every request should support

Loading

Success

Error

Retry

Offline

Empty State

Never display blank pages.

---

# Security

Environment Variables

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

VITE_CLOUDINARY_CLOUD_NAME

VITE_CLOUDINARY_UPLOAD_PRESET

Never expose secrets.

Never hardcode credentials.

---

# Authentication

Current MVP

Guest Shopping

Future

Supabase Auth

Google Login

Email Login

OTP Login

The UI should already support future authentication expansion.

---

# Performance Strategy

Lazy Loading

Code Splitting

Image Optimization

Component Memoization

Dynamic Imports

Optimized Assets

Responsive Images

Cloudinary CDN

Avoid unnecessary re-renders.

---

# Responsive Strategy

Desktop

≥1440px

Laptop

1280px

Tablet

768px

Mobile

480px

Small Mobile

360px

Every page must work across all breakpoints.

---

# Deployment Architecture

Developer

↓

GitHub

↓

Vercel

↓

Frontend

↓

Supabase

↓

Cloudinary

Deployment should require minimal configuration.

---

# Future Scalability

The architecture should support adding the following without major restructuring:

- Authentication
- Wishlist
- Product Reviews
- Admin Dashboard
- Vendor Dashboard
- Inventory Management
- Coupons
- Payment Gateway
- Order Tracking
- Notifications
- AI Product Recommendations
- Recently Viewed
- Multi-language
- Dark Mode
- Analytics
- Progressive Web App (PWA)

---

# Development Workflow

Requirement

↓

PRD Review

↓

Design Review

↓

Architecture Review

↓

Component Planning

↓

Implementation

↓

Testing

↓

Code Review

↓

Deployment

Every feature must follow this workflow.

---

# File Responsibilities

prd.md

Defines what to build.

design.md

Defines how the application should look.

guidelines.md

Defines coding standards and AI behavior.

architecture.md

Defines the technical structure, folder organization, data flow, services, database, deployment, and scalability strategy.

All four documents must remain synchronized. Any architectural or functional change should be reflected in the appropriate document before implementation begins.

---

# Implementation Notes — as built (Phase 0 / Phase 1)

This section records where the delivered code refines or extends the specification above.

## Toolchain

React 19 · TypeScript 6 · Vite 8 · Tailwind CSS **v4** (CSS-first `@theme`, no
`tailwind.config.js`) · React Router 7 (data router) · React Hook Form + Zod · Lucide ·
`@supabase/supabase-js` · `clsx` + `tailwind-merge` + `class-variance-authority`.

Quality gates: ESLint 9 flat config (type-aware, `jsx-a11y` strict) and Prettier with automatic
Tailwind class ordering.

Framer Motion and TanStack Query remain unused. Both are marked optional; the animations required by
`design.md` (fade, slide, hover lift) are CSS-only, and no server state exists before Phase 10.

## Path alias

`@/` resolves to `src/`, declared in both `vite.config.ts` and `tsconfig.app.json`. ESLint forbids
relative imports that traverse two or more directories upward.

## Additional folder

`src/lib/` holds validated environment configuration and third-party client construction
(`lib/env.ts` today; the Supabase and Cloudinary clients from Phase 10). `services/` remains the
only place that performs data operations.

## Routing table — as built

| Path              | Page               |
| ----------------- | ------------------ |
| `/`               | Home               |
| `/shop`           | Shop               |
| `/shop/:category` | Shop (same module) |
| `/product/:id`    | Product Details    |
| `/cart`           | Cart               |
| `/checkout`       | Checkout           |
| `/order-success`  | Order Success      |
| `/orders`         | My Orders          |
| `/contact`        | Contact            |
| `*`               | Not Found          |

`/order-success` is required by `prd.md` section 12 and was missing from the routing list above.
`/shop` and `/shop/:category` share one module because category is a filter over the same listing,
not a separate page. Every route is lazily imported; failures are caught by `RouteErrorBoundary`,
which additionally recovers from post-deploy chunk-load failures with a reload.

## Environment variables

Vite only exposes `VITE_`-prefixed variables to the browser. The canonical client set is
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME` and
`VITE_CLOUDINARY_UPLOAD_PRESET`, validated at module load by `src/lib/env.ts`.

`SUPABASE_SERVICE_ROLE`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are server-only and must
never gain a `VITE_` prefix. The service role key bypasses Row Level Security entirely.

## Product facets — brand, color and availability

`prd.md` section 8 requires Brand, Color and Availability filters that the `products` table does not
model as columns. By project-owner decision these are encoded in the existing `tags` array using a
namespaced convention:

    brand:levis   color:navy   color:white   stock:in

All parsing is confined to a single typed facet utility in `utils/`. Components receive structured
values and never inspect raw tag strings, so promoting these to real columns later is a one-file
change. The Seller field in `design.md` maps to `brand:`; the Delivery estimate is derived from a
shared delivery-SLA constant rather than stored per product.

## Deployment

`vercel.json` pins the Vite framework preset, rewrites all paths to `index.html` for SPA routing,
applies immutable caching to fingerprinted assets, and sets `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`.

---

# Implementation Notes — Phase 2 (Core Layout)

## Component inventory

Layer-based, matching the folder contract above. No feature folders were introduced.

    components/
      buttons/Button/         Button.tsx, buttonVariants.ts
      common/Container/       Page gutter and 1320px content column
      common/Section/         Titled page band, labelled landmark
      common/Logo/            Inline SVG wordmark, inverted variant for the footer
      common/Breadcrumb/      Hierarchical trail, current crumb unlinked
      common/SearchBar/       Search form, navigates to /shop?q=
      layout/Header/          Header.tsx, CartLink.tsx
      layout/CategoryNav/     52px category bar
      layout/Footer/          Dark footer, link columns, social, copyright
      layout/MobileBottomNav/ Sticky bottom bar, hidden from tablet up

`MainLayout` composes Header → CategoryNav → `<main>` → Footer → MobileBottomNav, so every route
inherits the full chrome.

## Style variants live beside their component

`buttonVariants` is a separate module from `Button.tsx`. A file that exports both a component and a
non-component breaks React Fast Refresh, and the linter enforces this. Any future component with CVA
variants follows the same split.

Navigation actions render `<Link className={buttonVariants(...)}>` rather than a `<Link>` wrapped in
a `<button>`, which would be invalid HTML.

## Search state lives in the URL

The header search bar navigates to `/shop?q=<term>` rather than holding the term in component state.
Results become shareable, bookmarkable and back-button-friendly, and the Shop page reads the same
parameter in Phase 5. The parameter name is a constant in `constants/search.ts`; no literal `'q'`
appears anywhere else.

## New constants and types

- `constants/categories.ts` — the three PRD categories and their route links
- `constants/navigation.ts` — category bar, bottom bar, footer columns, social links
- `constants/search.ts` — Shop query-parameter names
- `types/navigation.ts` — `NavLink`, `IconNavLink`, `NavGroup`, `SocialLink`

Every navigation destination is table-driven. No route string is inlined in a component.

## Deliberate omissions

These are absent because the feature or route behind them does not exist. Linking to a 404 is worse
than omitting a control; each is added alongside its feature.

| Omitted            | Specified in            | Added in                    |
| ------------------ | ----------------------- | --------------------------- |
| Wishlist action    | design.md, prd.md §15   | With the Wishlist feature   |
| Account / Profile  | design.md, prd.md §6    | With Authentication         |
| Cart count badge   | design.md               | Phase 7, with CartContext   |
| Newsletter form    | phases.md Phase 2       | Phase 4, with its handler   |
| Query form         | phases.md Phase 2       | Phase 4, with its page      |
| Become Seller      | design.md               | No vendor feature in the PRD |

The Footer renders its newsletter column only when a submit handler is supplied, so Phase 4
completes it without restructuring.

---

# Implementation Notes — Shop listing

## Listing state lives in the URL

`hooks/useShopFilters.ts` is the single source of truth for search, filters, sort and page. It reads
the query string and the `/shop/:category` route segment into a `ShopFilters` object and writes every
change back. No listing state is held in component state.

This makes a result set shareable and bookmarkable, keeps the back button meaningful, and means a
reload restores exactly what the shopper was looking at. Search writes with `replace` so typing does
not fill the history stack.

Parameters: `q`, `brand`, `material`, `color`, `size`, `stock`, `min`, `max`, `sort`, `page`.
Multi-select values are comma separated. Names live in `constants/shop.ts`.

## Two queries per view

`services/shop.ts` exposes:

- `getShopProducts` — one page of rows plus an exact match count, with all filtering, sorting and
  paging done in Postgres. Every sort appends a stable `id` tiebreaker so paging cannot repeat or
  drop a row when the sort column holds duplicates.
- `getShopFacets` — the available filter values for the current selection.

The facet query deliberately applies category, search, price and availability but **not** the
multi-select facets themselves. Applying them would collapse each list to the single chosen value,
leaving the shopper unable to change their mind.

`applyFilters` is shared by both and is generic over a small structural interface rather than
Supabase's builder type, which exceeds TypeScript's instantiation depth when nested (TS2589). The
builder is narrowed to `ShopQuery` at the two call sites.

## Sortable pricing columns

Migration `0002_sortable_pricing.sql` adds `effective_price` and `discount_pct` as stored generated
columns, because PostgREST can only order by real columns. They are maintained by Postgres on every
write, so they cannot drift from `price` and `discount_price`.

## Facet scaling limit

`getShopFacets` scans at most 1000 rows to derive its option lists. Adequate now; past a few thousand
products this should become a materialised view or an RPC returning pre-aggregated counts rather
than a larger scan.

---

# Implementation Notes — Product Details

## Route

The product route is `/product/:slug`, **not** `/product/:id`. The routing table earlier in this
document said `:id`; every caller already passed a slug, so the parameter name was corrected rather
than the behaviour. `productPath(slug)` builds it.

## Services

`services/productDetail.ts` is separate from `services/shop.ts` so the detail route chunk does not
pull in the listing's facet machinery.

- `getProductBySlug` returns `null` for an unmatched slug, letting the page render Not Found instead
  of an error state.
- `getRelatedProducts` fetches a bounded set of same-category candidates and ranks them in memory
  (brand 4, material 2, collection 1), because PostgREST cannot order by that expression. When a
  category holds too few products it tops up from the wider catalogue.

## Purchase state

`pages/Product/usePurchase.ts` owns selected size, quantity, validation and cart interaction. Both
the purchase panel and the sticky mobile bar consume the same instance, so the two surfaces cannot
disagree about what is being bought. It delegates every mutation to CartContext and maps the four
`CartAddResult` values onto toast messages.

## Toast

`ToastProvider` sits above `CartProvider` in `App.tsx`. It is a polite live region so outcomes are
announced without stealing focus. Introduced here because add-to-cart is the first action that
changes state without navigating; Cart and Checkout are its next consumers.

## Commerce constants

`constants/commerce.ts` holds the delivery window, returns window, free-shipping threshold, shipping
fee and GST note, so the figures quoted on the product page cannot drift from those on Cart and
Checkout.

# Route addition — order detail

`/orders/:orderId` renders a single mock order, registered lazily in `AppRouter` like every other
route. `orderDetailPath(orderId)` builds it.

Orders are a frontend simulation: placed at checkout, persisted to `localStorage` under
`yarnvia.orders.v1`, and read back by Order Success, My Orders and Order Detail. Nothing is written
to Supabase — the `orders` table in the schema above remains unused. `lib/orderStorage.ts` is the
single seam to replace when a real order API arrives.

---

# Implementation Notes — Airpay payment integration

Implements `docs/payment.md`. Cash on Delivery, product data and Cloudinary are
unchanged; nothing was migrated.

## The server tier

This project was a pure static SPA. It now has a small server tier — Vercel
Functions under `api/` — because a payment integration cannot exist without one:
credentials must be held somewhere the browser cannot read, the gateway callback
is out-of-band and needs somewhere to land, and the payable amount must be
derived somewhere the shopper cannot edit.

    api/
      _lib/env.ts              zod-validated server env, parsed lazily
      _lib/db.ts               service-role Supabase client
      _lib/log.ts              structured logging, redacts secret-shaped keys
      _lib/http.ts             PublicError, error boundary, JSON conventions
      _lib/airpay.ts           IST date, privatekey, AES, checksum, CRC32, OAuth
      _lib/pricing.ts          server-side re-pricing from the catalogue
      _lib/callbackPayload.ts  untrusted callback parsing
      _lib/settle.ts           verification and idempotent settlement
      payments/create.ts       POST — price, record, sign
      payments/callback.ts     POST — Airpay server-to-server webhook
      payments/return.ts       GET|POST — browser landing, redirects to the SPA
      orders/[ref].ts          GET — authoritative status for the success page
      health.ts                deployment check

`tsconfig.api.json` typechecks this tree under `moduleResolution: bundler`, since
Vercel bundles the functions with esbuild. It deliberately also includes
`src/constants/commerce.ts`: the server imports the free-shipping threshold and
shipping fee from the same module the storefront quotes, so the displayed total
and the charged total cannot drift apart.

`vercel.json`'s catch-all rewrite became `/((?!api/).*)`. Without the negative
lookahead every `/api/*` request would be served `index.html`.

## Two order models, on purpose

| | Cash on Delivery | Pay Online |
| --- | --- | --- |
| Where the order lives | localStorage only | Supabase `orders`, cached locally |
| Who computes the amount | the browser | the server, from the catalogue |
| Who confirms it | nobody — nothing to confirm | Airpay Order Confirmation |

COD is byte-for-byte the pre-existing flow. It moves no money, so there is
nothing to verify and no reason to rewrite a working path. Persisting COD orders
server-side is a reasonable future change (`payment.md` §17 Q6) but is out of
scope here.

## Trust boundaries

Three rules govern the whole integration:

1. **The browser proposes, the server prices.** `/api/payments/create` accepts
   only `{ productId, size, quantity }` per line — there is no field in which a
   client could state a price. `orders.amount` is derived from `products` and is
   the figure every later check compares against.
2. **A redirect is not a payment.** Returning from Airpay proves only that a
   browser was pointed at a URL. The success page opens in a "confirming"
   state and asks the server.
3. **Only Order Confirmation settles an order.** `ap_SecureHash` is CRC32:
   unkeyed, and computable by anyone holding the merchant ID and username. It is
   checked as an integrity signal and is never treated as authentication. On a
   sandbox MID — where Order Confirmation does not work — orders are left
   unsettled rather than trusting the callback.

Idempotency needs no new infrastructure. Settlement is a single conditional
`UPDATE … WHERE order_ref = $1 AND payment_status NOT IN ('paid','failed',
'cancelled')`; Postgres row locking makes concurrent callbacks resolve to
exactly one winner, and the loser sees zero rows updated.

## Timezone

Airpay's checksum appends the merchant-local date and its reference
implementation is PHP `date('Y-m-d')` on an IST server. Vercel runs UTC, so
between 00:00 and 05:30 IST the UTC date is still the previous day — a checksum
built from `toISOString().slice(0, 10)` would be rejected for five and a half
hours every night and never during a daytime test. `istDate()` formats with
`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })`, and the boundary
is covered by tests.

## Callback domains

The two supplied URLs — `frontiva.online/callback/cpm/arp/collection` and
`kkchat.in/callback/cpm/arp/collection` — are **not** used and nothing is sent to
them. Neither domain is Yarnvia's. Yarnvia's own endpoint,
`/api/payments/callback`, is what should be registered. See `payment.md` §11;
the ownership question is still open and blocks callback registration.

## Testing

`vitest` was added (`npm test`). 64 unit tests cover the protocol primitives,
the IST boundary window, server re-pricing and amount tampering, callback
parsing, and settlement — including duplicate callbacks, a forged SUCCESS, and
an amount mismatch. No test contacts Airpay.

## Protocol verification — against official v4 documentation

Verified against `docs.airpay.co.in/v4/...` (OAuth2, Encryption, Decryption,
Checksum, Simple Transaction, Order Confirmation, IPN Callback) and the
`llms-full.txt` dump. No live request was made.

Confirmed exactly as implemented: the OAuth2 endpoint
`POST https://kraken.airpay.co.in/airpay/pay/v4/api/oauth2/`; AES-256-CBC with
PKCS5 padding; the encryption key as the **MD5 hex string used as 32 ASCII
bytes**; the IV as 8 random bytes hex-encoded to 16 characters and prefixed in
the clear; `privatekey = sha256(secret@username:|:password)`; the checksum as
ksort → values concatenated with no separator → `Y-m-d` appended → SHA-256; and
the `ap_SecureHash` CRC32 field order including the UPI `CUSTOMERVPA` suffix.

One genuine mismatch was found and fixed: **v4 wraps responses as
`{"response": "<16-hex IV><base64>"}`**, and the OAuth token is only readable
after decrypting that envelope (`data.access_token`). The original code read
`access_token` off the parsed JSON and would never have found it — a failure that
would have presented as an invalid-credentials error. `unwrapResponse` now
detects and decrypts the envelope, and tolerates the plain shape, because the
Decryption page ("all the API responses are encrypted") and the Order
Confirmation page ("the response is not encrypted") contradict each other.

## Callback architecture — with the client's existing relay

The client has confirmed that `frontiva.online/callback/cpm/arp/collection`
forwards to `kkchat.in/callback/cpm/arp/collection`, and that this is their
existing infrastructure. Yarnvia does not build, modify, or call it.

The consequence that matters: **Airpay's callback and success URLs are configured
per-MID, not per-transaction.** If they point at that relay, Airpay will never
call `/api/payments/callback` and the shopper's browser will never reach
`/api/payments/return`. Yarnvia therefore cannot depend on being notified.

It does not have to be. Order Confirmation is a *pull* API keyed by `orderid`,
which Yarnvia generates and owns, so Yarnvia can always ask rather than wait.
Three independent triggers now drive the same verification, and settlement is
identical regardless of which fires:

    /api/payments/callback   if the relay is ever pointed here   (push)
    /api/orders/:ref         shopper on the success page         (pull)
    /api/payments/reconcile  Vercel Cron, every 15 minutes       (sweep)

The sweep is what closes the gap where nobody is present — the shopper paid and
closed the tab, and no callback arrived. Without it those orders would sit at
`initiated` indefinitely while the money sat in the merchant account. It adds no
infrastructure: a `crons` entry in `vercel.json` against the existing function
runtime, authenticated with `CRON_SECRET`, batched and age-bounded.

`/api/payments/callback` is retained unchanged. It is deliberately indifferent to
its caller — Airpay directly, the client's relay, or anything else — because it
re-verifies through Order Confirmation and trusts nothing in the request body.
That property is why no shared secret is required for it to be safe, and why it
works under any of the four possible roles without modification.

### `requires_review`

Airpay confirming a payment for an amount that does not match `orders.amount` is
now a distinct terminal state rather than a log line. Marking it `failed` would
be false when money moved; leaving it `initiated` — as the first revision did —
meant the sweep would re-verify it forever and the shopper would sit on
"processing" with nothing surfacing the discrepancy. Nothing transitions out of
`requires_review` automatically.
