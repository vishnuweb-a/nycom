# Yarnvia Airpay Production Deployment Guide

Status: **not yet deployed.** No Airpay request has ever been made from this
codebase, and no live payment has been attempted.

Audience: a developer deploying this integration for the first time.

> **Read section 18 before you begin.** Two items there decide whether the
> online payment flow can work at all, and neither is fixable from the code.

---

## 1. Overview

Yarnvia is a React + Vite storefront on Vercel, with Supabase for catalogue data
and Cloudinary for imagery. Until this integration it was a pure static SPA with
no server tier.

Accepting online payment required one: credentials must live where the browser
cannot read them, the payable amount must be computed where the shopper cannot
edit it, and payment results must be verified server-to-server. That server tier
is a small set of Vercel Functions under `api/`.

What has **not** changed:

- Cash on Delivery works exactly as before — client-side, `localStorage`, no
  server involvement, no money movement to verify.
- Product, category and carousel data still come from Supabase via the anon key.
- Product images still come from Cloudinary. Nothing was migrated.

---

## 2. Architecture

```
Customer
   │
   ▼
Yarnvia SPA (Vercel static)  ── anon key ──▶ Supabase (catalogue, RLS read-only)
   │                          ── <img> ────▶ Cloudinary CDN
   │
   │  POST /api/payments/create   { productId, size, quantity } + address
   ▼                              (no prices — the client cannot state one)
Vercel Functions (api/)  ── service role ──▶ Supabase `orders`
   │                                          (RLS on, no policies)
   │  server re-prices, inserts order, mints OAuth token, signs payload
   ▼
   │  browser auto-POSTs signed form
   ▼
Airpay hosted payment page (payments.airpay.co.in)
   │
   │  customer pays
   ▼
   ├── IPN / success URL ──▶ configured PER-MID in the Airpay dashboard
   │                         (currently believed to be the client's relay:
   │                          frontiva.online ──▶ kkchat.in)
   │
   └── Yarnvia settles by PULLING the truth from Airpay:
          Order Confirmation API, keyed by orderid, server-to-server
```

**The most important property of this design:** Yarnvia does not depend on being
notified. Airpay's Order Confirmation API is a *pull* interface keyed by
`orderid`, a value Yarnvia generates and owns, so Yarnvia can always ask rather
than wait. Three triggers drive the same settlement path:

| Trigger | Endpoint | Fires when |
| --- | --- | --- |
| Push | `/api/payments/callback` | Airpay or the relay calls us — if ever configured |
| Pull | `/api/orders/:ref` | The shopper is on the success page |
| Sweep | `/api/payments/reconcile` | Vercel Cron, daily (Hobby plan limit) |

The sweep covers the case where nobody is present: the shopper paid and closed
the tab, and no callback arrived. Without it, those orders would sit unsettled
while the money sat in the merchant account.

---

## 3. Required Environment Variables

Derived by searching the repository for `process.env`, `import.meta.env`,
`VITE_`, and the two validation schemas (`src/lib/env.ts`,
`api/_lib/env.ts`). This is the complete list — 17 variables in three groups.

### 3.1 Server-only — Vercel, Production scope

Never `VITE_`-prefixed. Vite cannot bundle these, by design.

| Variable | Required | Scope | Source | Purpose | Secret? |
| --- | --- | --- | --- | --- | --- |
| `AIRPAY_MID` | Yes | Server | Airpay | Merchant ID; sent as `merchant_id`, and part of `ap_SecureHash` | Sensitive |
| `AIRPAY_CLIENT_ID` | Yes | Server | Airpay | OAuth2 `client_id` | Sensitive |
| `AIRPAY_API_KEY` | Yes | Server | Airpay | Currently unused — see §5 | **Secret** |
| `AIRPAY_SECRET_KEY` | Yes | Server | Airpay | OAuth2 `client_secret` **and** the privatekey `secret` — see §5 | **Secret** |
| `AIRPAY_USERNAME` | Yes | Server | Airpay | Part of privatekey, AES key and `ap_SecureHash` | **Secret** |
| `AIRPAY_PASSWORD` | Yes | Server | Airpay | Part of privatekey and AES key | **Secret** |
| `AIRPAY_ENV` | Yes | Server | You (`live`) | Gates Order Confirmation. Must be `live` or `sandbox` | No |
| `SUPABASE_URL` | Yes* | Server | Supabase | Project URL for the service-role client | No |
| `SUPABASE_SERVICE_ROLE` | Yes | Server | Supabase | Bypasses RLS to read/write `orders` | **Secret** |
| `PUBLIC_SITE_ORIGIN` | Recommended | Server | Your domain | Builds the redirect target after payment | No |
| `CRON_SECRET` | Yes | Server | Generate | Authenticates the cron reconciliation endpoint | **Secret** |

\* `SUPABASE_URL` falls back to `VITE_SUPABASE_URL` if unset
(`api/_lib/env.ts`), since the project URL is not a secret. Setting it
explicitly is clearer.

**On `PUBLIC_SITE_ORIGIN`:** the schema marks it optional, and
`api/payments/return.ts` falls back to the `x-forwarded-host` header. That
fallback is fine for previews but should not be relied on in production —
set it explicitly so the post-payment redirect target is deterministic.

**On `CRON_SECRET`:** it is read directly in `api/payments/reconcile.ts`, not
through the `serverEnv()` schema. If it is missing, that endpoint returns 503
and **reconciliation silently stops** — the rest of the app keeps working, so
this failure is easy to miss. Set it.

### 3.2 Frontend / public — build-time, bundled into the browser

These are compiled into the JavaScript bundle and are visible to anyone. That is
correct and intended for all four.

| Variable | Required | Scope | Source | Purpose | Secret? |
| --- | --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Public | Supabase | Catalogue queries | No |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public | Supabase | Public by design; RLS enforces safety | No |
| `VITE_CLOUDINARY_CLOUD_NAME` | Yes | Public | Cloudinary | Builds image URLs | No |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Optional | Public | Cloudinary | Unsigned upload preset | No |

The build **fails fast** if any required one is missing — `src/lib/env.ts`
validates at module load.

### 3.3 Local tooling only — do NOT add to Vercel

Used exclusively by `scripts/seed.mjs`, run manually with `npm run seed`.

| Variable | Source | Purpose |
| --- | --- | --- |
| `CLOUDINARY_API_KEY` | Cloudinary | Seeding product imagery |
| `CLOUDINARY_API_SECRET` | Cloudinary | Seeding product imagery |

Adding these to Vercel would put credentials in production for no reason. Leave
them in your local `.env`.

---

## 4. Airpay Credentials

Six values, all issued by Airpay. If you do not have them, they come from the
Airpay merchant dashboard or your Airpay account manager — not from anything in
this repository.

| Variable | Airpay's name for it |
| --- | --- |
| `AIRPAY_MID` | Merchant ID |
| `AIRPAY_CLIENT_ID` | OAuth Client ID |
| `AIRPAY_API_KEY` | API Key |
| `AIRPAY_SECRET_KEY` | Secret Key |
| `AIRPAY_USERNAME` | Merchant username |
| `AIRPAY_PASSWORD` | Merchant password |

---

## 5. Credential Mapping

> ### ⚠ Deployment note — the stated mapping was wrong
>
> **`AIRPAY_SECRET_KEY` is the OAuth2 `client_secret`, not `AIRPAY_API_KEY`.**
>
> The merchant identified `AIRPAY_API_KEY` as the OAuth secret and this
> integration originally used it. The live gateway rejected every such request:
>
> ```
> {"data":{"success":false,"msg":"Invalid client id or secret"}}
> ```
>
> The identical request carrying `AIRPAY_SECRET_KEY` returned a token. The
> result held across url-encoded and multipart bodies and both URL forms, so the
> credential was the only variable that mattered.
>
> Note the trap in that response: the outer envelope still reads
> `status_code 200, response_code "00", status "success", message "Success"`.
> Those describe the transport, not the outcome. The verdict is `data.success`.
>
> **`AIRPAY_SECRET_KEY` therefore serves two roles** — the OAuth secret and the
> `secret` in the privatekey derivation — and **`AIRPAY_API_KEY` is currently
> unused.** It is kept as a required variable because it is an issued credential
> that may belong to another Airpay product. Worth asking Airpay what it is for.
>
> There is still no `AIRPAY_CLIENT_SECRET` variable, and none should be added.

How each credential is actually used:

```
OAuth2 encrypted payload
    client_id     ← AIRPAY_CLIENT_ID
    client_secret ← AIRPAY_SECRET_KEY     ← verified against the live gateway
    merchant_id   ← AIRPAY_MID
    grant_type    = client_credentials

privatekey  = sha256( AIRPAY_SECRET_KEY @ AIRPAY_USERNAME :|: AIRPAY_PASSWORD )
AES key     = md5( AIRPAY_USERNAME ~:~ AIRPAY_PASSWORD )   ← hex string, 32 ASCII bytes
ap_SecureHash inputs include AIRPAY_MID and AIRPAY_USERNAME
```

Supplying `AIRPAY_API_KEY` as the OAuth secret produces
`data.msg: "Invalid client id or secret"` — but inside an envelope that still
says `"success"`, so it is easy to misread as a working authentication whose
token has merely moved. Always read `data.success`.

---

## 6. Supabase Configuration

Both values come from **Supabase Dashboard → Project Settings → API**.

| Value | Where in the dashboard | Scope |
| --- | --- | --- |
| Project URL | "Project URL" | Safe to expose. Used as both `SUPABASE_URL` and `VITE_SUPABASE_URL` |
| `anon` / publishable key | "Project API keys → anon public" | **Safe for the frontend.** Public by design; RLS is the protection |
| `service_role` key | "Project API keys → service_role" | **Server-only. Never expose** |

### The service-role key

It bypasses Row Level Security entirely. It exists here for exactly one reason:
the `orders` table has RLS enabled with **no policies at all**, so under Postgres
RLS nothing is permitted — the anon key in the browser bundle can neither read
nor write an order. Those rows hold shipping addresses and the authoritative
payable amount.

The service role must **never** be:

- given a `VITE_` prefix (this would bundle it into the browser)
- referenced anywhere in `src/`
- committed to Git
- pasted into a client-side config, a support ticket, or a screenshot

If it is ever exposed, rotate it in the Supabase dashboard immediately; every
order in the database is readable and writable with it.

---

## 7. Vercel Configuration

### 7.1 Project and repository

| Setting | Value |
| --- | --- |
| Git repository | `https://github.com/vishnuweb-a/nycom.git` |
| Production branch | `main` |
| Framework preset | Vite (declared in `vercel.json`) |
| Build command | `npm run build` (runs `tsc -b && vite build`) |
| Output directory | `dist` |
| Functions | Auto-detected from `api/` |

Everything above is already declared in `vercel.json`; you should not need to
override it in the dashboard.

### 7.2 What `vercel.json` actually contains

Documented from the real file — nothing invented:

```jsonc
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",

  // The negative lookahead is essential. Without it the catch-all would serve
  // index.html for /api/* and every function would appear to 404.
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],

  // Reconciliation sweep. Requires CRON_SECRET.
  "crons": [{ "path": "/api/payments/reconcile", "schedule": "0 3 * * *" }],

  "headers": [ /* immutable asset caching; nosniff, DENY, Referrer-Policy,
                  Permissions-Policy on all routes */ ]
}
```

### 7.3 Environment variables

Set every variable from §3.1 and §3.2 under **Settings → Environment Variables**,
scoped to **Production** (and Preview, if you want previews to work).

Do **not** add `CLOUDINARY_API_KEY` or `CLOUDINARY_API_SECRET`.

### 7.4 Cron

**This project is on the Hobby plan, which permits cron only once per day.**
`vercel.json` is set to `0 3 * * *` (08:30 IST) accordingly.

This matters: a sub-daily schedule on Hobby is rejected at deploy time and
**fails the entire deployment**, leaving production on the previous commit. If a
deploy ever succeeds locally but never appears on the site, check this first.

Consequence of the daily cadence: a shopper who pays and closes the tab may wait
up to a day for their order to settle. Shoppers who return to the success page
are unaffected. On Pro, raise it to `*/15 * * * *`.

Vercel presents `Authorization: Bearer $CRON_SECRET` automatically once
`CRON_SECRET` is set as an environment variable.

### 7.5 Redeployment after changing variables

**Environment variable changes do not take effect until you redeploy.** This
applies to both groups, for different reasons:

- `VITE_*` values are **inlined into the bundle at build time**. Changing one
  without rebuilding leaves the old value baked into the shipped JavaScript.
- Server variables are read at runtime, but existing warm function instances
  keep the old environment until they are replaced.

After changing anything: **Deployments → ⋯ → Redeploy**.

---

## 8. Airpay Dashboard Configuration

This is the part that cannot be completed from the codebase, and it is the main
outstanding blocker.

### What Airpay controls

Airpay's return/success URL and IPN callback URL are configured **per merchant
ID, in the Airpay dashboard** — not supplied per transaction. The official
Simple Transaction documentation says only that the customer is redirected to
"the success url configured at airpay", and its request parameter table contains
no return-URL field.

That has a hard consequence: **whatever is registered on this MID is where every
Yarnvia payment will send the customer and the notification.** Yarnvia cannot
override it per order.

### Step 1 — read the current configuration (do this first)

Log into the Airpay merchant dashboard for this MID and record:

- the configured **Success / Return URL**
- the configured **IPN / Callback URL**
- whether the MID is used by anyone else

Do not change anything yet. What you find determines everything below.

### Step 2 — decide, based on what you found

| If the Success/Return URL is… | Then… |
| --- | --- |
| Already a Yarnvia URL | Confirm it is exactly `https://www.yarnvia.online/api/payments/return` |
| The client's relay (`frontiva.online/...`) | **The customer never returns to Yarnvia.** See below |
| Empty / unset | Set it to `https://www.yarnvia.online/api/payments/return` |

If it points at the relay, one of these must happen — it is the client's
decision, not a code change:

1. **Repoint the return URL** to `https://www.yarnvia.online/api/payments/return`; or
2. **Have the relay redirect the browser onward** to
   `https://www.yarnvia.online/api/payments/return`, preserving the `orderid`; or
3. **Accept that customers do not return to Yarnvia.** The payment still settles
   correctly via the cron sweep, but the shopper sees no confirmation page. This
   is a poor experience and not recommended.

### Step 3 — the IPN / callback URL is optional

`POST /api/payments/callback` is available at
`https://www.yarnvia.online/api/payments/callback` if the client wants Yarnvia
notified directly. It requires **no code change** to accept traffic and needs no
shared secret to be safe, because it re-verifies everything through Order
Confirmation and trusts nothing in the request body.

If the client prefers to leave the IPN pointing at their existing relay, that is
fine. The cron sweep covers it. **Do not remove or repoint the client's relay.**

### What Yarnvia never does

Yarnvia does not build, modify, proxy, or send anything to
`frontiva.online/callback/cpm/arp/collection` or
`kkchat.in/callback/cpm/arp/collection`. Those are the client's existing
infrastructure. They appear in this codebase only in explanatory comments.

---

## 9. Callback Architecture

Three distinct concepts, deliberately not mixed:

| # | Concept | Owner |
| --- | --- | --- |
| 1 | Airpay payment processing | Airpay |
| 2 | Existing callback forwarding (`frontiva` → `kkchat`) | The client |
| 3 | Yarnvia order/payment verification | Yarnvia |

Yarnvia's endpoint serves as a **reconciliation and verification endpoint that
is indifferent to its caller.** It works identically whether invoked by Airpay
directly, by the client's relay, or never at all.

What happens to a callback that does arrive:

```
1.  Parse as untrusted input. All documented fields preserved
    (merchant_id, orderid, ap_transactionid, amount, transaction_status,
     transaction_payment_status, message, ap_SecureHash, customer_vpa),
    matched case-insensitively, decrypting an encdata envelope if present.
2.  Look up the order by reference. Unknown → log and stop.
3.  Already terminal → duplicate, stop. (Idempotency.)
4.  Verify ap_SecureHash (CRC32) — integrity only, NOT authentication.
5.  DISCARD the body as evidence.
6.  Call Airpay Order Confirmation, server-to-server. This decides the outcome.
7.  Compare Airpay's amount to orders.amount, to the paisa.
8.  Conditional UPDATE → settle exactly once.
9.  Always return HTTP 200, to avoid Airpay retry storms.
```

Step 5 is the point of the design. A forged callback claiming SUCCESS cannot
produce a settlement, because the claim is never consulted.

---

## 10. Return URL Architecture

```
Airpay ──▶ /api/payments/return   (POST or GET, fields in body or query)
              │
              │  runs the same settlement as the callback — they race, and
              │  either may win; settlement is safe to attempt twice
              │
              │  looks up the order's access_token SERVER-SIDE
              │  (never accepted from the query string)
              ▼
           303 redirect to
           <PUBLIC_SITE_ORIGIN>/order-success?ref=<order_ref>&t=<access_token>
              │
              ▼
           SPA opens in a "Confirming your payment" state and calls
           GET /api/orders/:ref?t=... for the authoritative status
```

**The browser return is never treated as proof of payment.** Arriving at the
success page proves only that a browser was pointed at a URL, which anyone can
do. The page renders success only when the server — having called Order
Confirmation — reports `paid`.

States the success page can show: `PROCESSING`, `PAID`, `FAILED`, `CANCELLED`,
`REQUIRES_REVIEW`.

---

## 11. Database Migration

### Status: **NOT APPLIED.** This must be done before the first payment.

`supabase/migrations/0003_orders.sql` creates one table, `public.orders`:

- `order_ref` — unique merchant reference sent to Airpay as `orderid`
- `access_token` — opaque per-order read key for the success page
- `status` — fulfilment lifecycle
- `payment_method` — `cod` | `airpay`
- `payment_status` — `pending` | `initiated` | `paid` | `failed` | `cancelled` |
  `requires_review`
- `amount` — **the authoritative payable figure**, server-derived
- `address`, `items` — JSONB snapshots
- `ap_transactionid`, `ap_verified_at` — the Airpay link (three columns, not a
  mirrored transaction table)
- `inventory_applied` — guard for future inventory work
- three indexes, an `updated_at` trigger reusing `set_updated_at()` from `0001`
- **RLS enabled with no policies** — see §6

### How to apply

Supabase Dashboard → **SQL Editor** → **New query** → paste the contents of
`supabase/migrations/0003_orders.sql` → **Run**. Every statement is idempotent,
so re-running is safe.

> ### ⚠ Do not use `supabase/setup.sql` — it is stale
>
> `supabase/setup.sql` is a convenience concatenation of migrations 0001–0003.
> It was generated **before** `requires_review` was added to the
> `payment_status` CHECK constraint and has not been regenerated.
>
> If you run `setup.sql`, the constraint will be created **without**
> `requires_review`. Everything will appear to work until the first payment
> arrives for the wrong amount — at which point the settlement write fails with
> a CHECK violation, at the exact moment correct handling matters most.
>
> **Use the numbered migration files.** If you need `setup.sql`, regenerate it
> from the migrations first and verify with:
> `grep -c requires_review supabase/setup.sql` → must be non-zero.

### Verify afterwards

```sql
-- 1. Table exists with the right columns
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'orders'
order by ordinal_position;

-- 2. requires_review is in the constraint (guards against the stale setup.sql)
select pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.orders'::regclass and contype = 'c';
-- expect 'requires_review' to appear

-- 3. RLS is on
select relrowsecurity from pg_class where oid = 'public.orders'::regclass;
-- expect: true

-- 4. There are NO policies (this is correct, not a mistake)
select count(*) from pg_policies
where schemaname = 'public' and tablename = 'orders';
-- expect: 0
```

Also confirm from the browser, using the anon key, that `orders` is unreadable.
It must return no rows and no data.

---

## 12. Safe Environment Template

Placeholders only. **Never commit a filled-in copy.** `.gitignore` already
excludes `.env`; keep it that way.

```bash
# ── Airpay — SERVER ONLY, never VITE_ prefixed ──
AIRPAY_MID=<FROM AIRPAY DASHBOARD>
AIRPAY_CLIENT_ID=<FROM AIRPAY DASHBOARD>
AIRPAY_API_KEY=<FROM AIRPAY DASHBOARD>          # currently unused (see §5)
AIRPAY_SECRET_KEY=<FROM AIRPAY DASHBOARD>       # OAuth client_secret + privatekey
AIRPAY_USERNAME=<FROM AIRPAY DASHBOARD>
AIRPAY_PASSWORD=<FROM AIRPAY DASHBOARD>
AIRPAY_ENV=live

# ── Supabase — server ──
SUPABASE_URL=<FROM SUPABASE PROJECT SETTINGS → API → Project URL>
SUPABASE_SERVICE_ROLE=<FROM SUPABASE PROJECT SETTINGS → API → service_role>

# ── Yarnvia ──
PUBLIC_SITE_ORIGIN=<ENTER PRODUCTION YARNVIA ORIGIN>   # e.g. https://example.com

# ── Security ──
CRON_SECRET=<GENERATE A SECURE RANDOM SECRET>

# ── Frontend — bundled into the browser, public by design ──
VITE_SUPABASE_URL=<FROM SUPABASE — same as SUPABASE_URL>
VITE_SUPABASE_ANON_KEY=<FROM SUPABASE → API → anon public>
VITE_CLOUDINARY_CLOUD_NAME=<FROM CLOUDINARY>
VITE_CLOUDINARY_UPLOAD_PRESET=<FROM CLOUDINARY — optional>

# ── Local seeding only — do NOT add to Vercel ──
CLOUDINARY_API_KEY=<FROM CLOUDINARY>
CLOUDINARY_API_SECRET=<FROM CLOUDINARY>
```

To generate `CRON_SECRET` locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it yourself and paste the output straight into Vercel. Do not record it in
this repository, a ticket, or a chat message.

### Source of each value

| Value | Get it from |
| --- | --- |
| `AIRPAY_MID` | Airpay dashboard |
| `AIRPAY_CLIENT_ID` | Airpay dashboard |
| `AIRPAY_API_KEY` | Airpay dashboard |
| `AIRPAY_SECRET_KEY` | Airpay dashboard |
| `AIRPAY_USERNAME` | Airpay dashboard |
| `AIRPAY_PASSWORD` | Airpay dashboard |
| `AIRPAY_ENV` | You — `live` for this MID |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE` | Supabase → Project Settings → API |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary console |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary console |
| `PUBLIC_SITE_ORIGIN` | Your Vercel production domain — see note below |
| `CRON_SECRET` | Generate securely (command above) |
| `CLOUDINARY_API_KEY` / `_SECRET` | Cloudinary console — local only |

> ### `PUBLIC_SITE_ORIGIN` — confirmed from the Vercel dashboard
>
> ```
> PUBLIC_SITE_ORIGIN=https://www.yarnvia.online
> ```
>
> The Vercel project (`nycom`) has exactly two domains attached:
> **`www.yarnvia.online`** and `nycom-bay.vercel.app`. An earlier
> `yarnvia.vercel.app` value in `constants/app.ts` was a placeholder for a
> domain that does not exist on this project and would not have resolved.
>
> Applied to `PUBLIC_SITE_ORIGIN`, `APP.origin` in `src/constants/app.ts`, and
> the `<link rel="canonical">` in `index.html`.
>
> `src/constants/company.ts` separately reads `yarnvia.online` without `www` —
> the registered domain as written in the legal copy, not a URL. Left as is.
>
> **`www` is part of the origin.** Airpay matches the return URL literally, so
> `https://www.yarnvia.online` and `https://yarnvia.online` are different
> origins to it. Register
> `https://www.yarnvia.online/api/payments/return` on the `www` host.
>
> Prefer pointing Airpay at the canonical host rather than relying on a
> redirect: the return leg is a form POST, and a redirect hop adds a way for
> fields to be dropped.

---

## 13. Deployment Procedure

Follow in order. Each phase depends on the one before it.

```
PHASE 1 — Resolve the unknowns          ← do this FIRST; it is not a code task
   │  Read the Airpay dashboard: current return URL, IPN URL, MID sharing
   │  Decide the production domain (see §12 note)
   ▼
PHASE 2 — Supabase
   │  Apply supabase/migrations/0003_orders.sql   (NOT setup.sql — see §11)
   │  Run the four verification queries
   │  Confirm the anon key cannot read `orders`
   ▼
PHASE 3 — Vercel configuration
   │  Set all §3.1 and §3.2 variables, Production scope
   │  Generate and set CRON_SECRET
   │  Attach the production domain
   │  Confirm your plan permits the cron schedule
   ▼
PHASE 4 — Airpay dashboard
   │  Configure / confirm the Success–Return URL per §8
   │  Configure / confirm the IPN URL, or deliberately leave it with the relay
   │  Confirm the MID is not shared
   ▼
PHASE 5 — Deploy
   │  Push to main, or Redeploy
   │  Confirm the build succeeds
   ▼
PHASE 6 — Health check
   │  GET https://<domain>/api/health
   │  Expect { ok: true, configured: true, airpayEnv: "live" }
   │  configured:false ⇒ a server variable is missing or invalid
   │  Confirm https://<domain>/shop still renders (the rewrite is intact)
   ▼
PHASE 7 — OAuth smoke test          ← the first real Airpay contact
   │  Requires explicit authorization. Mints a token only; moves no money
   ▼
PHASE 8 — Payment creation test
   │  Reach the Airpay payment page; confirm the amount matches the cart
   │  Confirm an `initiated` row exists in Supabase
   │  ABANDON the payment — do not complete it
   ▼
PHASE 9 — Controlled live payment    ← requires explicit written authorization
   │  One low-value transaction (₹1–2)
   │  Verify Order Confirmation, orders.payment_status = 'paid',
   │  the success page, and the callback/sweep path
   │  Refund from the Airpay dashboard
   ▼
PHASE 10 — Monitor
      Watch the first days of reconciliation logs for
      requires_review and unresolved orders
```

**Phases 7–9 make live requests against a production MID.** They are documented
here, not performed. Do not run them without explicit authorization.

---

## 14. Verification Procedure

### Before deploying — local, safe, no external calls

```bash
npm ci
npm test            # 68 tests
npm run typecheck
npm run lint
npm run format:check
npm run build
```

All five must pass. The test suite contacts nothing external.

### After deploying — Phase 6

```bash
curl -s https://<domain>/api/health
# {"ok":true,"configured":true,"airpayEnv":"live"}

curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/shop      # 200, SPA
curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/api/health # 200, JSON
```

If `/api/health` returns HTML, the `vercel.json` rewrite is wrong and every
function is being shadowed by `index.html`.

### Confirm no secret reached the browser

```bash
# From a production build — must produce no matches
grep -ri "airpay_secret\|airpay_password\|airpay_api_key\|service_role" dist/
```

Then open the deployed site, view source, and check the Network tab: no Airpay
credential and no access token may appear in any response.

### Regression check — COD must still work

Place a Cash on Delivery order end to end. It must behave exactly as before:
no server call, order in `localStorage`, success page immediate. **No `orders`
row is created for COD** — that is correct and intended.

---

## 15. Production Checklist

**Pre-deployment**

- [ ] Airpay dashboard read; current return and IPN URLs recorded
- [ ] Production domain decided and consistent across the repo
- [ ] Confirmed the MID is not shared with another merchant
- [ ] `npm test` / typecheck / lint / format / build all pass locally

**Database**

- [ ] `0003_orders.sql` applied (NOT `setup.sql`)
- [ ] `orders` table verified
- [ ] `requires_review` present in the `payment_status` constraint
- [ ] RLS enabled and policy count is zero
- [ ] Anon key confirmed unable to read `orders`

**Environment — server**

- [ ] `AIRPAY_MID`
- [ ] `AIRPAY_CLIENT_ID`
- [ ] `AIRPAY_API_KEY`
- [ ] `AIRPAY_SECRET_KEY`
- [ ] `AIRPAY_USERNAME`
- [ ] `AIRPAY_PASSWORD`
- [ ] `AIRPAY_ENV=live`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE`
- [ ] `PUBLIC_SITE_ORIGIN` = `https://www.yarnvia.online`
- [ ] `CRON_SECRET`

**Environment — frontend**

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `VITE_CLOUDINARY_CLOUD_NAME`
- [ ] `VITE_CLOUDINARY_UPLOAD_PRESET` (if used)
- [ ] Confirmed no `VITE_AIRPAY_*` variable exists anywhere

**Vercel**

- [ ] Production domain attached and matching `PUBLIC_SITE_ORIGIN`
- [ ] Cron schedule valid for the plan (Hobby = daily only; a sub-daily
      schedule fails the deployment outright)
- [ ] Redeployed after the final variable change

**Airpay dashboard**

- [ ] Success / Return URL configured and agreed with the client
- [ ] IPN / callback decision made and recorded
- [ ] Client's existing relay left untouched

**Post-deployment**

- [ ] Deployment succeeded
- [ ] `/api/health` returns `configured: true`
- [ ] `/shop` renders (rewrite intact)
- [ ] COD regression test passed
- [ ] No secret in the bundle or in any network response
- [ ] OAuth smoke test completed (authorized)
- [ ] Payment creation verified; amount matches the cart
- [ ] Callback / return flow verified
- [ ] Order Confirmation verified
- [ ] `orders.payment_status` correct in Supabase
- [ ] Controlled live payment completed (authorized)
- [ ] Live payment refunded
- [ ] Reconciliation cron observed running

---

## 16. Troubleshooting

### OAuth error 903

**Symptom:** OAuth returns HTTP 400 with `response_code` 903; logged as
`airpay.oauth.no_token`. Checkout shows "We could not start a secure payment."

**Likely cause:** credential mismatch — most often `AIRPAY_API_KEY` not actually
being the OAuth `client_secret`, or `AIRPAY_CLIENT_ID` / `AIRPAY_MID` wrong.

**Check:** all three values, character for character, including trailing
whitespace from copy-paste. Confirm the MID is active for API access.

**Do NOT blindly:** invent an `AIRPAY_CLIENT_SECRET` variable, or swap
`AIRPAY_API_KEY` and `AIRPAY_SECRET_KEY`. They feed different algorithms; a
"lucky" swap can produce a token while silently breaking every checksum. Confirm
the mapping with the merchant instead.

### Missing environment variable

**Symptom:** `/api/health` returns `configured: false`; payment endpoints return
500. Or the **frontend build fails** with "Invalid environment configuration".

**Likely cause:** a variable unset, or set on the wrong Vercel scope.

**Check:** every name in §3.1 and §3.2, scoped to Production. Server variable
names are listed in the error but values never are — that is deliberate.

**Do NOT blindly:** relax the schema in `api/_lib/env.ts` to make the error go
away. It is telling you a credential is genuinely absent.

### Checksum mismatch / transaction rejected

**Symptom:** Airpay rejects the transaction despite a valid token. Often
**intermittent, striking only between 00:00 and 05:30 IST.**

**Likely cause (that window):** a date/timezone mismatch. Airpay expects the IST
date; Vercel runs UTC, and for those 5.5 hours the UTC date is still yesterday.

**Check:** `istDate()` in `api/_lib/airpay.ts` uses
`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })`. The unit tests pin
this boundary — run `npm test`.

**Do NOT blindly:** replace it with `toISOString().slice(0, 10)`. That is the
bug this code exists to prevent, and it fails only at night.

### Encryption / decryption failure

**Symptom:** OAuth returns a body with no readable `access_token`; or callback
`encdata` will not decrypt.

**Likely cause:** wrong AES key derivation, or `AIRPAY_USERNAME` /
`AIRPAY_PASSWORD` incorrect.

**Check:** the key is `md5(username ~:~ password)` **as its 32-character hex
string used as ASCII bytes** — not hex-decoded to 16 bytes. Hex-decoding halves
the key to 128 bits and fails silently. The IV is 16 hex characters prefixed in
the clear. Both are pinned by tests.

**Do NOT blindly:** "fix" the MD5 to be hex-decoded. It is deliberate and
verified against Airpay's official documentation.

### Callback not received

**Symptom:** no `payment.callback` log lines ever appear.

**Likely cause:** entirely expected — the IPN URL for this MID probably points
at the client's relay, not at Yarnvia.

**Check:** the Airpay dashboard IPN URL. Then confirm the **sweep** is working:
look for `payment.reconcile.swept` every 15 minutes.

**Do NOT blindly:** repoint the client's relay, or build a forwarder. Yarnvia is
designed not to need the callback.

### Return URL not reached

**Symptom:** after paying, the customer lands somewhere that is not Yarnvia, or
on a generic page.

**Likely cause:** the dashboard success URL points at the relay, or at a domain
that is not the deployed one.

**Check:** the dashboard success URL against `PUBLIC_SITE_ORIGIN` and the actual
Vercel production domain. All three must agree.

**Do NOT blindly:** assume the payment failed. It very likely succeeded — check
`orders.payment_status`, and let the sweep settle it.

### Order stuck in processing

**Symptom:** `payment_status` stays `initiated`; the success page eventually
shows "Payment still processing".

**Likely causes:** the payment is genuinely `INPROCESS` (normal for UPI and net
banking); or cron is not running; or `AIRPAY_ENV` is `sandbox`, under which
Order Confirmation cannot work and the code refuses to settle.

**Check:** `AIRPAY_ENV=live`; `CRON_SECRET` set; cron executions in the Vercel
dashboard; `payment.verify.*` log lines.

**Do NOT blindly:** mark the order paid by hand before confirming with Airpay
that money actually moved.

### Amount mismatch

**Symptom:** `payment_status = 'requires_review'`;
`payment.verify.amount_mismatch` logged with expected and reported figures.

**Likely cause:** the catalogue price changed between order creation and
payment, or something is genuinely wrong.

**Check:** the logged expected vs reported amounts against the Airpay dashboard
for that `orderid`.

**Do NOT blindly:** mark it paid or failed. This state exists precisely because
automation should stop. Refund or correct manually, then update the row
deliberately.

### Supabase permission error

**Symptom:** payment creation returns 503; or `orders` queries return no rows
from a function.

**Likely cause:** `SUPABASE_SERVICE_ROLE` missing or holding the anon key
instead. With RLS on and no policies, the anon key sees nothing — which is
correct, and looks exactly like an empty table.

**Check:** that the value is the `service_role` key, not `anon`.

**Do NOT blindly:** add an RLS policy to `orders` to "fix" it. The absence of
policies is the security control.

### Cron not executing

**Symptom:** no `payment.reconcile.swept` lines; unattended orders never settle.

**Likely cause:** `CRON_SECRET` unset (endpoint returns 503), or the plan does
not permit the schedule.

**Check:** Vercel → Cron Jobs for execution history; confirm `CRON_SECRET`
exists. A 404 from the endpoint means the bearer token did not match — that is
the deliberate response to a bad secret.

**Do NOT blindly:** remove the authentication to make it run. That would let
anyone drive Order Confirmation traffic against the live MID.

### Vercel function failure

**Symptom:** 500 from any `/api/*` route.

**Check:** the function logs. Every handler is wrapped so unexpected errors are
logged with a reason and the customer sees only a generic message.

**Do NOT blindly:** return internal error text to the client. The generic
message is intentional — gateway internals and request echoes end up in error
strings.

---

## 17. Security Rules

1. **No Airpay credential may ever carry a `VITE_` prefix.** That would bundle
   it into the browser. Verified absent; keep it that way.
2. **Never commit `.env`.** Already gitignored. Verified: no secret value
   appears in the repository's git history.
3. **The service-role key is server-only.** Never in `src/`, never in the
   browser, never in a screenshot.
4. **The server always computes the amount.** The create endpoint's schema has
   no price field at all — a client cannot express one.
5. **A redirect is never proof of payment.** Only Order Confirmation settles.
6. **`ap_SecureHash` is integrity, not authentication.** CRC32 is unkeyed and
   reproducible by anyone holding the MID and username.
7. **Never log a secret.** The logger redacts secret-shaped keys, but the first
   defence is not passing them.
8. **Rotate anything exposed** — Airpay credentials via Airpay, the service role
   via Supabase, `CRON_SECRET` by regenerating.
9. **Do not weaken a check to clear an error.** Every guard here fails closed on
   purpose.

---

## 18. Remaining Blockers / Unknowns

Ordered by how much they block. The first two must be resolved by the client or
in a dashboard — no code change can address them.

### Blockers

1. **Airpay Success / Return URL destination for this MID — UNRESOLVED.**
   If it points at the client's relay, customers never return to Yarnvia and see
   no confirmation. Payments still settle via the sweep, but the experience is
   broken. Requires a client decision (§8).

2. **MID sharing — UNCONFIRMED.** The relay path suggests this MID may already
   serve another merchant. Since return URLs are per-MID, a shared MID may mean
   Yarnvia needs its own.

3. **Supabase migration not applied.** §11.

4. **`supabase/setup.sql` is stale** and will create the `payment_status`
   constraint without `requires_review`. Use the numbered migrations, or
   regenerate `setup.sql` first. This file was left unmodified because this task
   was documentation-only.

5. **Production domain — using the Vercel default.**
   `PUBLIC_SITE_ORIGIN`, `constants/app.ts` and the `index.html` canonical all
   read `https://yarnvia.vercel.app`. `constants/company.ts` cites
   `yarnvia.online` as the registered domain in the legal copy, so the
   storefront is currently served from a domain its own legal pages do not name.
   Confirm whether a custom domain is intended before go-live; if so, change all
   four places listed in §12 together. §12.

6. **No Vercel Function has ever executed.** The Airpay libraries are unit
   tested, but no handler has run in a real runtime, and OAuth has never been
   exercised against the live endpoint.

7. **No live payment has been made.** Requires explicit authorization.

### Known uncertainties — documented, non-blocking

- **`TRANSACTIONID` ↔ `orderid` in the CRC32 formula.** The IPN payload contains
  `orderid` but no `transactionid`; the code treats them as the same value. If
  wrong, the hash check **fails closed** — the order stays unsettled and is
  logged as `hash_mismatch`, never a false success.
- **OAuth request Content-Type.** Airpay's PHP sample passes an array to cURL,
  which implies `multipart/form-data`; this code sends
  `application/x-www-form-urlencoded`. PHP reads both identically via `$_POST`.
  Second thing to try if OAuth misbehaves.
- **Order Confirmation response encryption.** Airpay's Decryption page says all
  responses are encrypted; the Order Confirmation page says its response is not.
  The code handles both shapes.
- **Cron cadence.** Hobby permits daily only, so unattended orders can take
  up to a day to settle. Raise to `*/15 * * * *` if the plan is upgraded.

---

*This guide documents the codebase as implemented. It performs no deployment and
makes no external request. Phases 7–9 of §13 contact Airpay with production
credentials and require explicit authorization before anyone runs them.*
