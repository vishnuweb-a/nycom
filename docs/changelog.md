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
