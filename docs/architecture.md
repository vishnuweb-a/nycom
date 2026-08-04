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
