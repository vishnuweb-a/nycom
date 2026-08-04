# Yarnvia

> Style Woven For Every Generation.

A modern fashion ecommerce storefront for Men, Women and Children — built frontend-first with a
deliberately lightweight backend.

## Stack

| Layer     | Technology                                  |
| --------- | ------------------------------------------- |
| Framework | React 19 + TypeScript, Vite 8               |
| Styling   | Tailwind CSS v4 (CSS-first `@theme` tokens) |
| Routing   | React Router (data router, per-route lazy)  |
| Forms     | React Hook Form + Zod                       |
| Icons     | Lucide                                      |
| Data      | Supabase (PostgreSQL)                       |
| Media     | Cloudinary (sole media origin)              |
| Hosting   | Vercel                                      |

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase and Cloudinary values
npm run dev
```

## Scripts

| Script                 | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Start the dev server                      |
| `npm run build`        | Type-check and produce a production build |
| `npm run preview`      | Serve the production build locally        |
| `npm run lint`         | ESLint (type-aware, includes `jsx-a11y`)  |
| `npm run typecheck`    | TypeScript only                           |
| `npm run format`       | Prettier write                            |
| `npm run format:check` | Prettier verify                           |

## Project structure

```
src/
├── assets/       Static local assets (never product imagery — that lives in Cloudinary)
├── components/   Reusable UI, grouped by kind (common, product, layout, forms, …)
├── constants/    Route table, brand metadata, enumerations
├── context/      Cross-cutting React contexts (cart, theme, auth)
├── hooks/        Reusable stateful logic
├── layouts/      Page shells (MainLayout)
├── lib/          Third-party client setup and validated environment
├── pages/        One folder per route
├── router/       Route table and error boundary
├── services/     All data access — no component may call an API directly
├── styles/       global.css — the design system
├── types/        Shared domain types
└── utils/        Pure helpers
```

## Design system

All visual tokens live in a single `@theme` block in [`src/styles/global.css`](src/styles/global.css)
and mirror [`docs/design.md`](docs/design.md). Tailwind's default color, typography, radius, shadow
and breakpoint scales are reset to `initial`, so off-system utilities such as `bg-blue-500` or
`text-xs` generate no CSS at all — a violation renders visibly unstyled instead of shipping a
plausible but off-brand value. Tailwind does not error on unknown utilities, so this is a loud
safety net rather than a hard gate.

Breakpoints are mobile-first, with the unprefixed base tier being Small Mobile (360px):

| Prefix | Width  | Device       |
| ------ | ------ | ------------ |
| —      | 360px  | Small Mobile |
| `xs:`  | 480px  | Mobile       |
| `md:`  | 768px  | Tablet       |
| `lg:`  | 1024px | Laptop       |
| `xl:`  | 1280px | Desktop      |
| `2xl:` | 1440px | Desktop XL   |

## Environment

Only `VITE_`-prefixed variables reach the browser bundle. `SUPABASE_SERVICE_ROLE`,
`CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are server-only and must **never** gain a `VITE_`
prefix — the service role key bypasses Row Level Security entirely.

## Documentation

| Document                                | Defines                              |
| --------------------------------------- | ------------------------------------ |
| [prd.md](docs/prd.md)                   | What to build                        |
| [design.md](docs/design.md)             | How it should look                   |
| [guildline.md](docs/guildline.md)       | Coding standards and agent behaviour |
| [architecture.md](docs/architecture.md) | Technical structure and data flow    |
| [phases.md](docs/phases.md)             | Delivery roadmap                     |
| [changelog.md](docs/changelog.md)       | Append-only record of completed work |
