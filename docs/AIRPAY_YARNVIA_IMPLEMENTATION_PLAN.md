# Airpay Implementation Plan — Yarnvia

**This document is a plan. Nothing in it has been implemented by the task that
wrote it.** No application code, database schema, `vercel.json` or environment
file was modified.

## How to read this plan

The brief assumed a greenfield integration. **Yarnvia already has a working
Airpay payment tier.** Every phase below is therefore labelled with what actually
needs doing:

| Label | Meaning |
| --- | --- |
| ✅ **DONE** | Implemented and tested. Verify, do not rebuild |
| 🔶 **GAP** | Missing or incomplete. Real work |
| 🔴 **DEFECT** | Implemented but wrong or unproven. Highest priority |
| 🔷 **VERIFY** | Exists; needs production confirmation rather than code |

Companions: [Architecture](AIRPAY_YARNVIA_ARCHITECTURE.md) ·
[Verification](AIRPAY_YARNVIA_VERIFICATION.md) ·
[Configuration](AIRPAY_YARNVIA_CONFIGURATION.md)

---

## Recommended order of work

The phases are numbered as the brief specified, but they should not be executed
in numerical order. **Do this instead:**

| Order | Phase | Why first |
| --- | --- | --- |
| 1 | **Phase 9** — Order Confirmation | Nothing settles until this is fixed. Everything else is already working |
| 2 | **Phase 2** — add `AIRPAY_VERIFY_URL` | Makes phase 9 a config change instead of a deploy cycle |
| 3 | **Phase 1** — `payment_events` audit table | Needed to diagnose phase 9 with evidence rather than log-scraping |
| 4 | **Phase 13** — tests for the above | Pin the fix |
| 5 | **Phase 14** — deploy and re-verify the stranded orders | Recover `YV-3200A-2AB47227` and the eight `failed` rows |
| 6 | **Phases 6, 8, 12** — verification-only | Confirm in production |
| 7 | **Phases 3, 4, 5, 7, 10, 11** — hardening only | The remaining gaps in each |

---

## PHASE 1 — Database / order-state preparation

**Status: 🔶 GAP** — the `orders` table is complete; the callback audit table is missing.

### Responsibility
Give every inbound callback a durable, deduplicated record, so that "Airpay never
called" can be told apart from "Airpay called and we could not parse it".

### Files
| File | Action |
| --- | --- |
| `supabase/migrations/0004_payment_events.sql` | **Create** |
| `supabase/setup.sql` | **Fix** — currently stale, omits `requires_review` from the CHECK |
| `api/_lib/db.ts` | Unchanged |
| `api/_lib/callbackFlow.ts` | **Modify** — insert the event before settling |

### Design
Model on Frontiva's `public.payment_events`:

- `id`, `order_ref` (nullable), `dedupe_key` (**unique**), `payload jsonb`, `created_at`
- Unique index on `dedupe_key` makes a redelivery a **no-op insert**
- Index on `order_ref`
- **RLS enabled with no policy** — the browser's anon key must not reach it
- End the migration with `notify pgrst, 'reload schema'`; Yarnvia's existing
  migration omits this and PostgREST will otherwise report a missing column

`dedupe_key = sha256(orderRef|apTransactionId|transactionStatus)`, falling back to
hashing the raw body when no identifier is recognisable.

### Inputs / outputs
In: the parsed callback fields. Out: a boolean "first delivery?", used only for
logging — **settlement must not depend on it.**

### Dependencies
None.

### Security
- Redact before storing. **Carry over Frontiva's hard-won detail:** a real Airpay
  IPN sends `CUSTOMERPHONE`, `CUSTOMEREMAIL`, `CUSTOMERVPA` with **no separator**.
  A redaction list containing only the punctuated spellings lets live customer PII
  straight through.
- Also redact `encdata`, `checksum`, `privatekey`, `token`.
- An audit-insert failure must **never block settlement** — settlement is
  idempotent anyway.

### Tests
- Redelivery of an identical payload inserts once
- A different `transactionStatus` for the same order inserts a second row
- PII fields are `[redacted]`, audit fields (`AMOUNT`, `TRANSACTIONSTATUS`,
  `APTRANSACTIONID`) are retained
- A thrown database error does not prevent `settleOrder` running

---

## PHASE 2 — Airpay configuration and environment variables

**Status: ✅ DONE, with one recommended addition**

### What exists
`api/_lib/env.ts` validates seven Airpay variables plus Supabase and
`PUBLIC_SITE_ORIGIN` through a Zod schema, **lazily**, so a missing variable fails
the one request that needs it rather than crashing every function including the
health check.

### 🔶 The one addition worth making now
Add **`AIRPAY_VERIFY_URL`** (optional, defaulting to the current constant).

> With the Order Confirmation defect open, being able to switch between
> `/api/verify/` and `/api/orderconfirmation/` by changing an environment variable
> turns a multi-deploy investigation into a one-minute test. This is the
> highest-leverage small change in the whole plan.

### Files
`api/_lib/env.ts`, `api/_lib/airpay.ts`, `.env.example`

### Security
The variable must not be `VITE_`-prefixed. Validate it parses as a URL and is on
an `airpay.co.in` host, so a misconfiguration cannot redirect verification traffic
to an attacker-controlled endpoint.

### Tests
- Schema rejects a missing variable by name, never by value
- Default is used when the variable is unset
- A non-Airpay host is rejected

---

## PHASE 3 — Airpay crypto / OAuth utilities

**Status: ✅ DONE — do not rewrite**

Every primitive in `api/_lib/airpay.ts` matches the proven Frontiva
implementation byte for byte: the MD5-hex-as-ASCII AES key, the 8-random-bytes →
16-hex-chars → 16-ASCII-bytes IV, AES-256-CBC with PKCS#7, `IV ‖ base64` with no
delimiter, the `privatekey` SHA-256, and the values-sorted-by-key + IST-date
checksum. All are pinned by `api/_lib/airpay.test.ts`.

### 🔶 Two small hardening items

| Item | Rationale |
| --- | --- |
| Send an explicit **`User-Agent`** on Airpay calls | Node's `fetch` sends none. Frontiva's source records that WAFs 403 anonymous clients *before the request reaches the API*, and it looks exactly like a credential error. Yarnvia has not hit this — dormant, not disproven |
| Add an explicit **inner-failure gate** | Yarnvia relies on "no `access_token` ⇒ fail". Frontiva rejects `data.success:false` *before* looking for a token, so a response carrying both a false success flag and a token-shaped field cannot slip through |

### Security
Never log a credential, a derived key, an `encdata` blob or an access token.
Never log an Airpay error body raw — it can echo the submitted request.

### Tests (already present, extend for the above)
IST rollover at 20:00 UTC; AES round trip; a fresh IV per call; checksum
independent of declaration order; `privatekey` derived from `API_KEY` and **not**
from `SECRET_KEY`; OAuth posts exactly three form fields; token cache reuse and
expiry.

---

## PHASE 4 — Payment creation endpoint

**Status: ✅ DONE**

`POST /api/payments/create` re-prices from the catalogue, inserts the order, mints
the token, and returns `{orderRef, accessToken, amount, actionUrl, fields}`.

### The security property to preserve
There is **nowhere in the request schema for the client to state a price**. Not a
unit price, not a subtotal, not a shipping fee, not a total. A client submitting a
₹1 total for a ₹5,000 basket is charged ₹5,000 because its total was never read.

### 🔶 Open item
Yarnvia inserts the order **before** OAuth; Frontiva authenticates first so a
credential failure leaves no orphan `initiated` row. Yarnvia's order is deliberate
(a gateway outage leaves a record rather than a silent nothing) but it depends on
reconciliation closing the orphan. Once the sweep is confirmed working in
production, this needs no change. Until then, be aware that a run of `initiated`
rows may be OAuth failures, not abandoned checkouts.

### Tests (present)
Shipping threshold matches `src/constants/commerce.ts` exactly; out-of-stock
rejects the whole basket; quantity bounds; discount price wins; grand total
rounds to paisa.

---

## PHASE 5 — Airpay checkout redirect / form submission

**Status: ✅ DONE**

`redirectToAirpay()` builds a hidden `<form method="POST">` and submits it with
`merchant_id`, `encdata`, `checksum`, `privatekey` to
`https://payments.airpay.co.in/pay/v4/?token=...`.

A form POST, not a redirect — the hosted page expects a form body. The browser
module performs **no cryptography**: it does not sign, hash, encrypt or hold a
credential. Every value in the form is already public by Airpay's design.

### 🔶 Open item
The cart is cleared on `paid` rather than at submission time, so an abandoned
payment leaves the basket intact. Confirm this is the desired behaviour with the
merchant — Frontiva makes the same choice deliberately.

### Tests
Form action equals `actionUrl`; every returned field becomes a hidden input; no
credential name appears in the built form beyond what the server sent.

---

## PHASE 6 — Public callback endpoint

**Status: ✅ DONE → 🔷 VERIFY in production**

```
POST /callback/cpm/arp/collection  ->  api/callback/cpm/arp/collection.ts
GET  /callback/cpm/arp/collection  ->  same handler, browser branch
```

### The rule this phase exists to protect

> **The public callback URL must resolve to a real serverless function BEFORE the
> SPA catch-all rewrite. It must NOT become `index.html`.**

This is exactly what went wrong before: `/callback/...` fell through the SPA
catch-all, a GET returned `index.html`, Airpay's POST was answered `405 Method Not
Allowed` with an empty body, and order `YV-3200A-2AB47227` — a real ₹81 UPI
payment — was stranded at `initiated`.

`vercel.json` already satisfies this and **is not modified by this task**:

```json
"rewrites": [
  { "source": "/callback/cpm/arp/collection",  "destination": "/api/callback/cpm/arp/collection" },
  { "source": "/callback/cpm/arp/collection/", "destination": "/api/callback/cpm/arp/collection" },
  { "source": "/((?!api/).*)",                 "destination": "/index.html" }
]
```

Three load-bearing properties: the callback rules **precede** the catch-all;
the trailing-slash variant is listed separately; the catch-all carries a
`(?!api/)` negative lookahead. Never reorder, never remove either guard.

### 🔷 Verification required (no code change)

```bash
curl -s -X POST https://www.yarnvia.online/callback/cpm/arp/collection \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d 'TRANSACTIONID=YV-TEST-DEADBEEF&TRANSACTIONSTATUS=200'
# MUST be {"received":true,...}   MUST NOT be <!doctype html>

curl -si -H 'Sec-Fetch-Dest: document' \
     'https://www.yarnvia.online/callback/cpm/arp/collection?TRANSACTIONID=YV-TEST-DEADBEEF'
# MUST be 303 + Location: .../order-success?...
```

Neither can settle anything: the reference does not exist and settlement
re-verifies with Airpay regardless.

### Tests (present, `api/callback/cpm/arp/collection.test.ts`, 567 lines)
Add a static assertion that reads `vercel.json` and fails if the callback rewrite
is not ordered ahead of the catch-all — Frontiva pins exactly this, and it is the
cheapest possible guard against a recurrence.

---

## PHASE 7 — Callback / IPN processing

**Status: ✅ DONE, with 🔶 two missing controls**

`processAirpayCallback()` in `api/_lib/callbackFlow.ts` is the single pipeline:
**parse → settle → relay**, in that order, shared by all three routes so they
cannot drift apart.

Parsing handles: form-encoded POST, JSON POST, raw string/Buffer bodies (a gateway
posting under `text/plain` or with **no `Content-Type` at all** would otherwise
flatten to nothing — a silent money bug), query strings, and the encrypted
`{merchant_id, response}` envelope. The decrypted plaintext **replaces** the outer
fields rather than merging, so an attacker cannot pair a genuine `encdata` with
unencrypted fields of their own choosing.

### 🔶 Gap 1 — order-reference format gate
Frontiva validates the extracted reference against a regex **before** it reaches a
database filter and calls this a security control, not a convenience. It also
stops Airpay's numeric `APTRANSACTIONID` ever being mistaken for a merchant
reference. Yarnvia performs no validation.

Add `/^YV-[A-Z0-9]{5}-[0-9A-F]{8}$/` in `callbackPayload.ts`, matching
`generateOrderRef()`. The Supabase client parameterises the value so this is not
currently an injection hole — but it is free, and it turns a class of malformed
input into an early, logged rejection.

### 🔶 Gap 2 — merchant-id check
Frontiva compares the callback's `MERCID` against `AIRPAY_MID` in constant time
and blocks unconditionally on mismatch: a callback for another merchant is not
ours to act on. Yarnvia does not check it at all.

Because Yarnvia *replaces* rather than merges on envelope unwrap, read `MERCID`
from the decrypted fields. Given the open question about whether MID 366950 is
shared with another merchant, this check has more value here than it did for
Frontiva.

### Security
The body is hostile input. Nothing in it decides the outcome — see Phase 9. The
endpoint is public and unauthenticated, and that is safe **because** the claim in
the request is never what decides the result.

### Tests (present, extend)
Existing: envelope decryption, case-insensitive field lookup, unparseable bodies,
query/body merge precedence, both legs settling identically. Add: reference-format
rejection, MID mismatch blocking, a `Content-Type`-less raw form body.

---

## PHASE 8 — KKChat forwarding

**Status: ✅ DONE → 🔷 VERIFY, plus two merchant decisions**

```
Airpay -> https://www.yarnvia.online/callback/cpm/arp/collection
       -> parse -> settle -> forward
       -> https://kkchat.in/callback/cpm/arp/collection
```

### The contract (already implemented, `api/_lib/relay.ts`)

| Property | Value |
| --- | --- |
| Method | `POST` |
| Content-Type | `application/json` |
| Accept | `application/json` |
| Body | A JSON **object** of the Airpay fields. `JSON.stringify` applied **exactly once** — not a quoted, escaped string of the same thing, which the receiving end parses very differently |
| Encoding | Values arrive as strings and stay strings. Nothing renamed, re-cased, re-encrypted, coerced, or dropped |
| Timeout | 5 000 ms via `AbortController` |
| Retry | **None.** Airpay redelivers unacked IPNs itself; retrying here would multiply that |
| Errors | Timeout, DNS, TLS, reset, 4xx, 5xx — all resolve to one log line |
| **Effect on settlement** | **NONE.** Runs after settlement is committed; returns `void`; cannot throw |
| Bounds | Max 64 fields, max 1 024 chars per value |
| Disable | `KKCHAT_CALLBACK_URL=off` |

> **Forwarding failure must never affect payment settlement.** This holds
> structurally, not by convention: settlement is committed before the relay runs,
> the return type is `void`, and every failure path resolves rather than rejects.

### 🔶 Gap — loop guard
Frontiva sends `x-frontiva-forwarded: 1` on its relay and refuses to forward
anything arriving with that header. Yarnvia has no such guard. If KKChat (or any
proxy) ever posts back to Yarnvia's public callback, nothing stops a loop. Add a
`x-yarnvia-forwarded` request header and an inbound check.

### Two decisions that need the merchant, not code

1. **Enveloped or unwrapped?** Frontiva relays the payload *as received*, still
   encrypted if it arrived encrypted. Yarnvia relays the fields *after* opening
   the envelope. If Airpay sends an enveloped callback, KKChat will receive
   plaintext fields where it previously received `{"merchant_id":…, "response":"…"}`.
   **UNKNOWN** whether KKChat handles the plaintext shape.

2. **One relay per payment, or two?** Yarnvia forwards **both** the browser leg
   and the IPN leg. **UNKNOWN** whether KKChat deduplicates.

### ⚠ Do not copy Frontiva's destination
Frontiva posts to `https://kkchat.in/callback/cpm/arp_frontiva/collection`.
Yarnvia's destination is `https://kkchat.in/callback/cpm/arp/collection`, the
value the team supplied. Different path — do not conflate them.

### Tests (present, `relay.test.ts`, 227 lines)
Default destination; override; `off`; POST + JSON headers; object-not-string body;
casing and string types preserved; not form-encoded; quiet on timeout, 4xx, 5xx;
abort signal passed; field-count cap; a genuine payload untouched. Add: loop-guard
header sent, and inbound loop-guard honoured.

---

## PHASE 9 — Order Confirmation verification

**Status: 🔴 DEFECT — THE BLOCKER. Nothing settles until this is resolved.**

### The problem

**OBSERVED**, confirmed against MID 366950 on 2026-08-21:

```
POST https://kraken.airpay.co.in/airpay/pay/v4/api/verify/?token=...
body: orderid=YV-3200A-2AB47227

HTTP 200
{ "merchant_id": null, "response": "509361e8503ab0a0I9NZa9e97O0qW189..." }
```

The envelope is well formed — 16 hex characters of IV, then 128 base64 characters
decoding to 96 bytes, block-aligned — but **it does not decrypt with
`md5(USERNAME~:~PASSWORD)`**, the key every outbound call uses and that Airpay
accepts on those calls. The format is understood; only the key is wrong.

### What it cost

`verifyTransaction` previously returned a confirmation with every field `null`,
and `settle.ts` compares `status !== 200`. Since `null !== 200`, "Airpay did not
tell us" was recorded as "Airpay said it failed". Order `YV-3200A-2AB47227` — a
genuine ₹81 UPI payment, Airpay transaction `2051234202`, shown as **Success** on
Airpay's own dashboard — was terminally marked `failed`. **Eight `failed` orders
from 2026-08-14, all with `ap_transactionid` null, carry the same signature and
should be treated as unverified rather than as genuine failures.**

Both directions are now guarded and this cannot recur — but nothing settles.

### The leading hypothesis — test it, do not assume it

Yarnvia's request differs materially from Frontiva's proven one:

| | Yarnvia | Frontiva |
| --- | --- | --- |
| Path | `/api/verify/` | `/api/orderconfirmation/` |
| Body | `orderid` only, plaintext | `{merchant_id, encdata, checksum, privatekey}` |
| `merchant_id` sent? | **No** | Yes, twice — as a form field and inside `encdata` |
| `privatekey` sent? | **No** | Yes |

> **`merchant_id: null` in Airpay's answer is the tell.** Yarnvia never sent one.
> Airpay resolves the merchant *from* `privatekey` — that is how the credential
> mapping was established at the hosted page. A request with no `privatekey` gives
> the gateway no merchant to resolve, which is consistent with a response
> encrypted under something other than this merchant's key, or with an error
> payload rather than a confirmation.

**This is INFERRED, not proven.** Three supports: Frontiva's spec-conformant
request sends all four fields; Airpay resolves the merchant from `privatekey`;
every other v4 endpoint in both codebases takes the envelope form and a bare
`orderid` is the outlier.

### The work, in order

1. **Add `AIRPAY_VERIFY_URL`** (Phase 2) so the path is switchable without a deploy.
2. **Build the signed envelope for verification**, exactly as Frontiva does:
   ```
   fields  = { merchant_id: MID, orderid: orderRef }
   body    = { merchant_id: MID,
               encdata:    IV + base64(AES-256-CBC(JSON(fields))),
               checksum:   sha256(MID + orderRef + istDate()),
               privatekey: sha256(API_KEY + "@" + USERNAME + ":|:" + PASSWORD) }
   POST <verifyUrl>?token=<accessToken>   form-urlencoded
   ```
   Note `merchant_id` appears **twice** — in the clear and inside `encdata`. Both
   are sent. The checksum's sorted-key order is `merchant_id, orderid`, so its
   input is `<MID><orderRef><IST date>`.
3. **Test against `/api/orderconfirmation/` and `/api/verify/`** and compare.
4. **If the envelope still will not open, ask Airpay integration support which key
   Order Confirmation responses are encrypted under.**

### ⛔ The rule that must not be broken

> **Do not guess the key, and do not invent the response shape.** A wrong guess
> that happens to produce parseable output would settle orders on fabricated data.
> That is strictly worse than the current state, in which nothing settles.

### Files
`api/_lib/airpay.ts` (`verifyTransaction`), `api/_lib/env.ts`, `.env.example`

### Security
Log `envelopeDecrypted` and `describeShape()` (key names only, never values) so a
decryption problem can be told apart from a field-naming problem — they need
opposite fixes and look identical from the outside. Never log the raw body.

### Tests
- The request body carries all four envelope fields
- `encdata` decrypts back to exactly `{merchant_id, orderid}`
- The checksum equals `sha256(MID + orderRef + istDate)`
- `privatekey` is derived from `API_KEY`, **not** `SECRET_KEY`
- The token is in the **query string**, not an `Authorization` header
- An undecryptable envelope returns `null` (regression, already present)
- A statusless body returns `null` (regression, already present)
- A well-formed confirmation is read correctly (already present)

---

## PHASE 10 — Idempotent settlement

**Status: ✅ DONE — the strongest part of the codebase**

### The rule
> An order may become `paid` **only** when Airpay was reachable, the transaction
> status classifies as successful, and the amount **exactly** matches the
> server-derived figure.

```
paid  <=>  isLiveMid()
      AND  verifyTransaction(orderRef) !== null
      AND  transactionStatus === 200
      AND  amount !== null
      AND  |amount - order.amount| <= 0.001      (a tenth of a paisa)
```

- **Unknown status fails closed.** Anything not explicitly recognised is a
  failure, never a success.
- **Unreachable Airpay is never `failed`.** It returns `pending` and writes
  nothing, leaving the order open for the sweep and the poll.
- **Sandbox refuses to settle**, deliberately — a sandbox convenience flag would
  be the exact hole the module exists to close.

### Idempotency — two guards
1. **Cheap path:** already terminal ⇒ `already_settled`, no Order Confirmation
   round trip on the second, third and fourth delivery.
2. **The real one:** every transition is a single conditional statement —
   `UPDATE … WHERE order_ref = $1 AND payment_status NOT IN ('paid','failed','cancelled','requires_review')`.
   The guard and the write are one statement; Postgres applies the row lock; the
   loser updates zero rows and reports `already_settled`. **No distributed lock
   and no Redis is needed — the database already provides the only atomicity
   required.**

### 🔶 Two open items

| Item | Detail |
| --- | --- |
| Status `210` | Yarnvia classifies it as **failed**; Frontiva as **pending**. If Airpay uses `210` for an in-flight transaction, Yarnvia would terminally fail it. Resolve with Airpay before volume |
| No explicit in-process state | Yarnvia writes nothing for `211`, leaving the order `initiated`. An order stuck because Airpay was unreachable is then indistinguishable, from the row alone, from one where the shopper never left checkout. Consider recording `ap_verified_at` and a last-outcome field even when no state change applies |

### Tests (present, `settle.test.ts`, 343 lines)
The stub honours the `not.in` filter — a stub that ignored it "would make these
tests pass while the real thing double-settled". Covers: unknown order, terminal
short-circuit, hash mismatch, sandbox refusal, inconclusive verification not
becoming `failed`, `null` status not becoming `failed`, amount mismatch →
`requires_review`, concurrent race, caller-claimed amount ignored in favour of the
gateway's.

---

## PHASE 11 — Success / failure frontend handling

**Status: ✅ DONE**

`/order-success?ref=<order_ref>&t=<access_token>` starts in `checking` and polls
`GET /api/orders/:ref?t=` every 3 s, up to 20 attempts (~60 s).

> The redirect proves only that a browser was pointed at a URL. **Anyone can type
> one.** The page therefore asserts nothing and asks the server, which answers only
> from verified Order Confirmation data.

States rendered: `checking`, `paid`, `failed`, `requires-review` (never shown as a
failure — the shopper may well have been charged), `unresolved` (genuinely unknown,
not failed), `not-found`.

The endpoint is a **self-healing poll**: if the order is not settled, it runs the
full `settleOrder` — the same trusted path, triggered by a different event.

### Security
- Access is by the opaque per-order `access_token`, compared in **constant time**.
  The order reference alone is not enough: references appear in the Airpay
  dashboard and in URLs, and an order row holds a shipping address.
- The redirect target's token is looked up **server-side** rather than taken from
  the request, so a crafted return URL cannot hand someone else's token back.
- One indistinguishable 404 for "no such order" and "wrong token", so the endpoint
  cannot be used to discover which references exist.
- The response is deliberately thin: status, amount, and the few facts the
  confirmation screen renders. No address, no gateway detail, no internal ids.

### 🔶 Open item
After ~60 s the page shows `unresolved`. With the Phase 9 blocker open, **every**
online payment currently reaches that state. Check the copy explicitly tells the
shopper their money is safe and the order is being checked — not that it failed.

---

## PHASE 12 — Reconciliation / cron

**Status: ✅ DONE → 🔷 VERIFY**

`POST|GET /api/payments/reconcile`, scheduled by `vercel.json` at `0 3 * * *`.

- Sweeps `payment_method='airpay'` and `payment_status IN ('initiated','pending')`
- Window: older than 5 minutes, younger than 7 days
- Batch: 50, oldest first
- Calls the same `settleOrder` with a synthetic reference-only payload — no hash,
  so the integrity check is skipped and the outcome comes purely from Order
  Confirmation, which is the only authority anyway
- `Authorization: Bearer $CRON_SECRET`, constant-time, **unset denies**; an
  unauthorised call gets **404**, not 401, so the endpoint does not advertise itself

Why a pull interface makes recovery possible: Order Confirmation is keyed by
`orderid`, a value Yarnvia generates and owns, **so settlement never actually
depends on being told. It can always ask.**

### 🔷 Verify in production
- The cron fires (Vercel dashboard → Cron Jobs → last run)
- Vercel's cron invocation actually satisfies `Bearer $CRON_SECRET`
- `payment.reconcile.swept` appears in the logs with a plausible `examined` count

### 🔶 Cadence caveat
Hobby permits cron **once per day**. A shopper who pays and closes the tab may
wait up to a day. `MAX_AGE_MS` is 7 days rather than 24 hours precisely so an
order created just after one run cannot age out before the next. On Pro, move to
`*/15 * * * *`.

---

## PHASE 13 — Testing

**Status: ✅ substantial suite exists (7 files, ~2 400 lines) — 🔶 extend per phase**

Run with `npm test` (Vitest). See the testing matrix below.

---

## PHASE 14 — Production deployment

**Status: 🔷 partially deployed; blocked on Phase 9**

### Pre-flight (no money moves)
1. `npm run typecheck && npm run lint && npm test`
2. Confirm no Airpay name is `VITE_`-prefixed:
   `grep -rE 'VITE_AIRPAY|VITE_.*SECRET|VITE_.*SERVICE_ROLE' src/ api/ .env.example`
3. Grep a production build for any credential value — must produce no matches
4. Confirm `supabase/migrations/0003_orders.sql` is applied and the
   `payment_status` CHECK includes `requires_review`

### Deploy
5. Set every variable from [Configuration section 10](AIRPAY_YARNVIA_CONFIGURATION.md)
6. Redeploy — variables bind at deploy time
7. `GET /api/health` → confirm `commit`, `configured: true`, `airpayEnv: "live"`

### Post-deploy verification
8. The two `curl` probes in Phase 6 — JSON and 303, never HTML
9. `GET /api/payments/reconcile` without a bearer token → **404**
10. COD checkout still works end to end (regression — `cod-regression` equivalent)

### First live transaction
11. Smallest possible real payment. Watch for, in order:
    `payment.initiated` → `airpay.oauth.issued` → `payment.callback.received`
    → `airpay.verify.*` → `payment.settled.paid`
12. Confirm the row reaches `paid` with `ap_transactionid` and `ap_verified_at` set
13. Confirm `payment.callback.forward.success` for KKChat
14. Confirm the success page renders `paid`

### Recovery of stranded orders — do this after Phase 9 lands
15. Re-verify `YV-3200A-2AB47227` and the eight `failed` rows from 2026-08-14.
    They are terminal, so the sweep will not pick them up — they need a deliberate,
    audited re-verification. **Reconcile against the Airpay dashboard before
    changing any row.**

### ⛔ Never
Deploy with `AIRPAY_ENV` unset or guessed. Skip the migration. Reorder the
`vercel.json` rewrites. Commit a `.env`. Put a credential in a log or an error
message.

---

## Testing matrix

### Local / unit

| Area | Cases | Status |
| --- | --- | --- |
| **Crypto** | MD5-hex-as-ASCII key is 32 bytes; AES-256-CBC round trip; IV is 16 hex chars used as ASCII; fresh IV per call; `IV ‖ base64` with no delimiter; too-short input rejected | ✅ present |
| **IST date** | 20:00 UTC on the 13th is the 14th IST; 18:00 UTC is still the 13th; format is `YYYY-MM-DD` | ✅ present |
| **Checksum** | Values only, sorted by key, no separator, IST date appended; independent of declaration order; changes when any value changes | ✅ present |
| **privatekey** | Equals `sha256(API_KEY@USER:\|:PASS)`; **not** equal to the `SECRET_KEY` variant | ✅ present |
| **OAuth** | Exactly three form fields; `privatekey` absent; credentials only inside `encdata`; form-encoded not JSON; token found when nested; token found in a JSON-*string* `data`; missing token fails; `expires_in` honoured; 300 s fallback; cache reused; cache expires; no credential in any error | ✅ present |
| **Inner failure** | `data.success:false` behind `status_code:200 / response_code:"00" / status:"success"` is rejected — **even when a token-shaped field is present** | 🔶 add |
| **ap_SecureHash (CRC32)** | Matches PHP `crc32()` as unsigned decimal; VPA appended last and only when present; mismatch returns false; empty hash skips the check | ✅ present |
| **Callback parsing** | Form POST; JSON POST; raw string body; Buffer body; **no `Content-Type`**; query-string GET; body wins over query; encrypted envelope replaces (not merges); wrong key degrades gracefully; hostile input never throws | ✅ present |
| **Callback validation** | Reference format gate rejects a foreign id; MID mismatch blocks | 🔶 add (Phase 7) |
| **Order lookup** | Unknown reference → `unknown_order`; COD order is never touched by a payment callback | ✅ present |
| **Amount validation** | Exact match passes; 1 paisa off → `requires_review`; `null` amount → `requires_review`; the caller's claimed amount is ignored in favour of the gateway's | ✅ present |
| **Settlement** | `200` + exact amount → `paid`; non-200 → `failed`; `211` → `pending` no write; `null` confirmation → `pending` **not failed**; statusless → `pending` **not failed**; sandbox → `unverifiable` | ✅ present |
| **Duplicate callbacks** | Terminal short-circuit; concurrent race loser reports `already_settled`; the stub honours the `not.in` filter | ✅ present |
| **Order Confirmation request** | Four envelope fields; `encdata` decrypts to `{merchant_id, orderid}`; checksum input; token in the query string | 🔶 add (Phase 9) |
| **KKChat forwarding** | Default destination; override; `off`; POST + JSON headers; object not string; casing/type preserved; not form-encoded; quiet on timeout/4xx/5xx; no retry; abort signal; field cap; genuine payload untouched | ✅ present |
| **Loop guard** | Outbound header set; inbound header suppresses relaying | 🔶 add (Phase 8) |
| **Audit / dedupe** | Redelivery inserts once; PII redacted incl. unpunctuated spellings; insert failure does not block settlement | 🔶 add (Phase 1) |
| **Pricing** | Shipping constants match `src/constants/commerce.ts`; out-of-stock rejects the basket; quantity bounds; discount wins; paisa rounding | ✅ present |
| **Routing** | `vercel.json` callback rewrite is ordered ahead of the SPA catch-all | 🔶 add (Phase 6) |

### Integration (stubbed gateway, real pipeline)

| Case | Assertion |
| --- | --- |
| Payment creation | Order row written `initiated` with the server-derived amount; response carries `actionUrl` + four fields; no credential in the response |
| OAuth failure | No order marked paid; 502 to the browser; error names no credential |
| Callback → settlement | One POST settles once; a second POST changes nothing |
| Browser leg → settlement | Same settlement, then 303 to `/order-success` — never `index.html` |
| Verification inconclusive | Order stays open; **never** `failed` |
| Amount mismatch | `requires_review`; the shopper is not told "failed" |
| Poll self-heal | `GET /api/orders/:ref` on an unsettled order runs the full verification |
| Reconcile | Only `initiated`/`pending` in the age window are swept; unauthorised → 404 |
| Relay | Fires after settlement; a 500 from the destination leaves the order `paid` |
| COD regression | A COD order is never reachable by a payment callback |

### Production smoke (⚠ read the warning below first)

| # | Check | Expected |
| --- | --- | --- |
| 1 | `GET /api/health` | `{"ok":true,"commit":"…","configured":true,"airpayEnv":"live","relayEnabled":true}` |
| 2 | `POST /callback/cpm/arp/collection` with a junk reference | `{"received":true}` — **JSON, never HTML, never 405** |
| 3 | `GET /callback/cpm/arp/collection` with `Sec-Fetch-Dest: document` | **303** to `/order-success` — never `index.html` |
| 4 | `GET /api/payments/reconcile` without a bearer token | **404** |
| 5 | `GET /api/orders/<real-ref>` with a wrong `t` | **404**, indistinguishable from an unknown reference |
| 6 | Payment creation from the real checkout | Order row `initiated`; `payment.initiated` logged |
| 7 | Airpay hosted page loads | No "Invalid Domain", no "Merchant Key Authentication Failed" |
| 8 | Response URL leg | `payment.callback.browser_return` logged; shopper lands on `/order-success` |
| 9 | IPN leg | `payment.callback.received` with `leg: "ipn"` |
| 10 | Order Confirmation | `airpay.verify.*` — **currently the blocker** |
| 11 | KKChat forwarding | `payment.callback.forward.success` |
| 12 | Order status | Row reaches `paid` with `ap_transactionid` and `ap_verified_at` |
| 13 | Success page | Renders `paid`, cart cleared |

> ### ⚠ Do not initiate any real payment during a documentation task
>
> Checks 1–5 are safe, read-only, and settle nothing — they use fabricated
> references and settlement re-verifies with Airpay regardless. **Checks 6–13
> require a real transaction and belong to Phase 14, not to this analysis.**
> Nothing in this task called Airpay, called KKChat, or moved money.

---

## Known unknowns — do not guess any of these

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | **The actual Airpay Order Confirmation response shape for Yarnvia** | **UNKNOWN** | Only the *encrypted* envelope has ever been seen. Field names, nesting, whether `data` is an object or a JSON string, whether the reference is echoed back — none of it is known. Both codebases use candidate name lists precisely because the shape is not known. **Do not invent it** |
| 2 | **Which key Order Confirmation responses are encrypted under** | **UNKNOWN** | The blocker. The format is understood; only the key is wrong. Ask Airpay. A wrong guess that produced parseable output would settle orders on fabricated data |
| 3 | Whether the missing `merchant_id`/`privatekey` in the request causes #2 | **INFERRED** | Strong hypothesis with three supports (Verification section 4.3). Test it; do not assume it |
| 4 | **The exact Airpay status-code set** | **UNKNOWN** | Only `200`, `SUCCESS`, `INPROCESS`, `IN_PROCESS`, `PENDING`, `210`, `211` are named anywhere. Everything else is bucketed as failed without knowing what it means. **`210` in particular**: Yarnvia treats it as failed, Frontiva as pending |
| 5 | **The actual callback payload for Yarnvia** | **UNKNOWN** | Frontiva has a real production IPN captured on 2026-08-14 (MID 366751) with 28 fields. Yarnvia has **no captured callback**. The field names are expected to match — Yarnvia's parser accepts them — but that is expectation, not proof |
| 6 | Whether Airpay returns browser and IPN payloads **identically** | **UNKNOWN** | Both codebases handle both legs the same way defensively; neither has compared two real deliveries for one transaction |
| 7 | Which of the two callback shapes (plaintext vs `{merchant_id, response}`) Airpay uses, and when | **UNKNOWN** | Both handled; the trigger for each is not known. Frontiva's `unwrapEnvelope` exists *because* the enveloped shape appeared unannounced, presenting as "no order reference found" |
| 8 | **Airpay's IPN retry / redelivery schedule** | **UNKNOWN** | Both codebases assume redelivery happens ("Airpay redelivers unacked IPNs on its own schedule") and both decline to retry outbound for that reason. The schedule itself is unspecified |
| 9 | **Whether the CRC32 `ap_SecureHash` construction is exactly right** | **INFERRED** | Transcribed from Airpay's documentation, so better founded than Frontiva's SHA-256 guess — but never validated against a real hash. The `TRANSACTIONID` ↔ `orderid` mapping in the formula is the specific uncertainty. **Fails closed**: a wrong formula strands orders, never falsely succeeds |
| 10 | **Sandbox behaviour and hostnames** | **UNKNOWN** | Order Confirmation is documented as live-MID-only. Sandbox hosts are not published in either codebase; the endpoint constants are hard-coded production hosts |
| 11 | **Whether MID 366950 is shared with another merchant** | **UNKNOWN** | The `/callback/cpm/arp/collection` path is the same one the earlier Frontiva/KKChat integration used. Since both URLs are per-MID, a shared MID may mean Yarnvia needs its own |
| 12 | Whether `www.yarnvia.online` is registered against the MID, and whether the site serves `www` as canonical | **UNVERIFIED** | Frontiva registered the *apex* and warns `www` would be a different origin. The deployment guide records `PUBLIC_SITE_ORIGIN` and the canonical still reading `yarnvia.vercel.app` |
| 13 | Expected length or character set of the five opaque credentials | **UNKNOWN** | Neither codebase asserts a length. Do not add one based on the values you hold |
| 14 | Whether Airpay permits or penalises OAuth token reuse | **UNKNOWN** | Yarnvia caches; Frontiva does not. Neither has been contradicted in production |
| 15 | Whether KKChat can parse an **unwrapped** relayed payload | **UNKNOWN** | Yarnvia relays post-unwrap, Frontiva pre-unwrap. Needs a merchant answer before the first enveloped callback |
| 16 | Whether KKChat deduplicates two relays for one payment | **UNKNOWN** | Yarnvia relays both the browser and IPN legs |
| 17 | Whether Vercel Cron's invocation satisfies `Bearer $CRON_SECRET` as configured | **UNVERIFIED** | Flagged as not determinable in the Frontiva analysis; confirm from the Vercel dashboard |
| 18 | What Airpay does with `successUrl` / `failureUrl` | **INFERRED** | Frontiva sends them "for completeness only" and states the MID-level dashboard settings are what apply. Yarnvia does not send them at all |
| 19 | Whether `supabase/migrations/0003_orders.sql` is applied in production | **UNVERIFIED** | The deployment guide says **not applied**. Not checked by this task |
| 20 | Whether the eight `failed` orders from 2026-08-14 are genuine failures | **INFERRED as not** | All have `ap_transactionid` null, the signature of the statusless-confirmation bug. Reconcile against the Airpay dashboard before changing any row |
| 21 | Any refund, void, capture or settlement-report API | **UNKNOWN** | Neither codebase implements one |

---

## Constraints honoured by the task that produced this plan

- Documentation only — no application code changed
- No database schema changed
- `vercel.json` not modified
- No environment file modified
- No real payment initiated
- Airpay not called
- KKChat not called
- Nothing deployed, committed or pushed
- No secret value recorded anywhere in these documents
- No undocumented Airpay behaviour fabricated — every uncertainty is tagged above
