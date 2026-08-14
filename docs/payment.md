YARNIVA + AIRPAY — FINAL IMPLEMENTATION PLAN
1. Actual Current Architecture
Your correction is right, and the code confirms it. Products are Supabase + Cloudinary. Orders are the localStorage part — a deliberately labelled mock.


Browser (React 19 + Vite 8 + react-router 8)
   │
   ├── @supabase/supabase-js  ── anon key ──▶ Supabase Postgres
   │                                          categories / products / carousel
   │                                          newsletter_subscribers / contact_queries
   │                                          (RLS: anon may SELECT active rows only)
   │
   ├── <img src=…>            ─────────────▶ Cloudinary CDN
   │                                          (Supabase stores only the URL reference)
   │
   └── localStorage
         yarnvia.cart.v1     — the cart
         yarnvia.orders.v1   — the mock orders
Deployment is a pure static SPA. vercel.json declares framework: vite, outputDirectory: dist, and a catch-all rewrite /(.*) → /index.html. There is no api/ directory and zero server-side code in production today. The only Node code is scripts/seed.mjs, run locally with SUPABASE_SERVICE_ROLE.

The six AIRPAY_* variables are already present in .env (unprefixed, so Vite correctly does not bundle them) but are absent from .env.example and referenced by nothing in src/.

2. Product Data Flow
Verified, unchanged, and not touched by this integration:


Supabase products row
  id uuid PK · slug unique · sku unique
  price numeric(10,2) · discount_price numeric(10,2) nullable
  effective_price  = coalesce(discount_price, price)   ← STORED GENERATED
  discount_pct     = floor(((price-discount)/price)*100) ← STORED GENERATED
  variants jsonb   = [{ size, color, quantity, stock }]
  images jsonb     = [{ secure_url, public_id, alt, width, height }]
  thumbnail jsonb  = {  same shape  }
        │
        ▼
src/services/{products,shop,productDetail,categories,cartValidation}.ts
  explicit column lists, .eq('active', true), optional AbortSignal
        │
        ▼
src/types/product.ts — Product interface mirrors columns 1:1
  effectivePrice(p) = p.discount_price ?? p.price
        │
        ▼
src/utils/cloudinary.ts — rewrites the stored secure_url, inserting
  f_auto,q_auto,dpr_auto,w_N,ar_4:5,c_fill,g_auto after /upload/
Cloudinary holds bytes; Supabase holds references; the transformation is computed at render time. Nothing here moves. Airpay never sees a product, a SKU, or an image.

3. Current Checkout Flow
src/pages/Checkout/CheckoutPage.tsx, traced line by line:

Guard: empty cart → <Navigate to="/cart">.
Address collected with react-hook-form + zodResolver(addressSchema) — 9 fields (addressSchema.ts).
Re-validation — getCartProducts(ids) (cartValidation.ts) refetches the live rows, then reconcileCart(items, products) (utils/cart.ts) re-derives price, stock and availability from the catalogue. The catalogue always wins. This is a genuinely good foundation for payment — the correct price already exists at checkout.
calculateOrderSummary(lines) — only purchasable lines contribute; shipping = total >= 999 ? 0 : 79 (constants/commerce.ts).
Confirm modal → confirmOrder() → setTimeout(900ms) → buildOrder() → appendOrder() → clearCart() → navigate to /order-success.
PaymentCard.tsx is presentational only — a fixed COD panel with no radio group, no form state, no selected-method value. There is currently no payment-method concept in the data model to extend; Order.paymentMethod is the literal type 'cod' and orderStorage.ts enforces z.literal('cod').

4. Current Order Flow
Orders exist only in the shopper's own browser. src/types/order.ts says so explicitly: "No order ever touches Supabase."

buildOrder() (utils/order.ts) generates YV-{base36 time}-{random} client-side.
appendOrder() prepends to yarnvia.orders.v1, zod-validated on every read.
OrderSuccessPage, OrdersPage and OrderDetail all call readOrders().
Consequences that matter for Airpay:

Merchant visibility	None. Yarniva has no record any order was ever placed — including today's COD orders.
Durability	Clearing site data destroys order history.
Trustworthiness	The amount is attacker-editable in DevTools.
Out-of-band writes	A gateway callback has nowhere to write.
This is the one blocking gap. Every other piece of your architecture is ready.

5. Airpay Role — what Airpay owns
Airpay owns the money and everything about how it moved. Confirmed against the live docs:

The transaction: ap_transactionid, rrn, amount, chmod (payment mode), card/bank/VPA detail, timestamps.
Status: transaction_payment_status ∈ SUCCESS | INCOMPLETE | FAIL | INPROCESS; transaction_status numeric (200 success, 211 processing, 400 failed).
The hosted payment page, PCI scope, 3DS, retries, payment-method routing.
Settlement, reconciliation, refunds, reporting — all in the merchant dashboard, queryable by orderid.
An "Airpay order" is thin: it is essentially { merchant orderid, amount, buyer contact } plus everything Airpay derives. Airpay never receives line items, SKUs, sizes, or shipping addresses beyond the buyer fields you choose to pass.

6. Yarniva Role — what Yarniva must own
Airpay cannot answer "what did this person buy, in what size, shipped where?" Only Yarniva can. Yarniva must own:

The order: line items, sizes, quantities, unit prices, shipping address, fulfilment status.
The authoritative amount — computed server-side from Supabase, so verification has something trustworthy to compare AMOUNT against.
The link: order_ref ↔ ap_transactionid ↔ payment_status.
Fulfilment lifecycle — pending → packed → shipped → out_for_delivery → delivered, which Airpay knows nothing about.
Inventory.
Yarniva must not duplicate: payment mode, card BIN, bank name, RRN, settlement batch, or the raw gateway response. Those are one dashboard lookup away, keyed by orderid.

7. Recommended Architecture

                    ┌───────────────────────────────┐
   Browser ────────▶│ Vercel Functions  (/api/*)    │──── service role ──▶ Supabase
   React SPA        │  secrets live here only        │                      orders (new)
      │             └───────────────────────────────┘                      products (existing)
      │                          │
      │                          ├── OAuth2 ──▶ kraken.airpay.co.in/.../oauth2
      │                          └── verify ──▶ kraken.airpay.co.in/.../verify
      │
      │  auto-submitted form POST (privatekey, encdata, checksum, merchant_id)
      └────────────────────────────▶ payments.airpay.co.in/pay/v4/?token=…
                                              │
                                     customer pays
                                              │
                    ┌─────────────────────────┴─────────────────────┐
                    ▼ browser redirect                              ▼ server-to-server
        /api/payments/return                             /api/payments/callback
                    │                                               │
                    └──────────▶ both verify, then ◀────────────────┘
                                 /api/payments/verify (server-authoritative)
                                              │
                                              ▼
                                   Supabase orders.payment_status
Supabase keeps doing exactly what it does today for catalogue. The new surface is one table and four functions.

8. Credential Mapping
Yarniva Environment Variable	Airpay Purpose
AIRPAY_MID	Merchant ID — merchant_id / mercid in every request
AIRPAY_CLIENT_ID	OAuth2 client_id
AIRPAY_API_KEY	OAuth2 client_secret (client-confirmed mapping)
AIRPAY_SECRET_KEY	The $secret in the privatekey derivation
AIRPAY_USERNAME	Merchant username — privatekey, AES key, ap_SecureHash
AIRPAY_PASSWORD	Merchant password — privatekey, AES key
No values displayed. All six stay unprefixed so Vite cannot bundle them, and go into Vercel Project Settings → Environment Variables (server scope). They must also be added to .env.example as empty keys under the existing "Server-side ONLY" heading.

Per the docs the derivations are:


privatekey      = sha256( SECRET + '@' + USERNAME + ':|:' + PASSWORD )
encryption key  = md5( USERNAME + '~:~' + PASSWORD )
encdata         = iv_hex(16) + base64( AES-256-CBC( json, key, iv ) )   PKCS5
checksum        = sha256( concat(values sorted by key) + 'YYYY-MM-DD' )
I did not invent AIRPAY_CLIENT_SECRET — the OAuth2 page names the field client_secret and your mapping supplies it from AIRPAY_API_KEY. See §17 for the one genuine ambiguity that remains.

9. Required Backend — minimum surface
Four routes and one shared lib. Nothing more.

File	Purpose
api/_lib/airpay.ts	encrypt / checksum / privatekey / IST date / OAuth token fetch / secure-hash verify
api/_lib/db.ts	Supabase client with SUPABASE_SERVICE_ROLE
api/payments/create.ts	POST — re-price cart from Supabase, insert order, mint token, return signed form fields
api/payments/callback.ts	POST — Airpay server-to-server webhook; verify; update order
api/payments/return.ts	POST/GET — browser landing; verify; 302 to /order-success
api/orders/[ref].ts	GET — authoritative status for the success page (poll while INPROCESS)
callback.ts and return.ts can share one handler with different response shapes if you prefer three files.

One required config change: the catch-all rewrite in vercel.json is "source": "/(.*)". Functions normally take filesystem precedence, but with a catch-all this must be made explicit or /api/* risks being served index.html:


{ "source": "/((?!api/).*)", "destination": "/index.html" }
10. Airpay Payment Flow

1  Shopper submits checkout
2  POST /api/payments/create  { cart: [{productId, size, qty}], address }
3  Server refetches products from Supabase, recomputes amount
      ── the client-sent total is discarded, never trusted
4  Server INSERTs orders row: payment_status='initiated', amount=<server figure>
5  Server POSTs oauth2  → { access_token, expires_in: 300 }
      body = { merchant_id, encdata, checksum }
      encdata encrypts { client_id, client_secret, merchant_id,
                         grant_type: 'client_credentials' }
6  Server builds { privatekey, encdata, checksum, merchant_id } and returns them
      encdata encrypts { orderid, amount, currency_code:'356',
                         iso_currency:'inr', buyer_email, buyer_phone,
                         buyer_firstname, buyer_lastname }
7  Client auto-submits a hidden form:
      POST https://payments.airpay.co.in/pay/v4/?token=<access_token>
8  Airpay hosted page — customer pays
9  Airpay → browser redirect to the success URL CONFIGURED IN THE AIRPAY DASHBOARD
   Airpay → server-to-server callback (same configured infrastructure)
10 Both paths verify ap_SecureHash:
      crc32( TRANSACTIONID : APTRANSACTIONID : AMOUNT :
             TRANSACTIONSTATUS : MESSAGE : MID : USERNAME )
      (UPI appends CUSTOMER_VPA)
11 Server calls Order Confirmation to get the truth:
      POST kraken.airpay.co.in/airpay/pay/v4/api/verify/?token=<access_token>
      body: orderid (x-www-form-urlencoded)
      ⚠ "This API will work only on live MID, for the sandbox MID
         this API will not work."
12 Compare returned amount to orders.amount. Mismatch ⇒ do not mark paid.
13 UPDATE orders SET payment_status, ap_transactionid, status='pending'
14 Decrement inventory (§14), once, guarded
15 Browser lands on /order-success and polls /api/orders/<ref> until settled
Step 3 is the whole security model. The browser proposes; the server prices.

11. Callback Flow — the two URLs

https://frontiva.online/callback/cpm/arp/collection
https://kkchat.in/callback/cpm/arp/collection
What I can establish: neither domain is Yarniva's, neither appears anywhere in this codebase, and the path shape (/cpm/arp/collection — plausibly collection-platform-module / airpay / collections) is a generic multi-tenant callback route, not an Airpay-issued URL. Airpay's own docs describe only "the success url configured at airpay" — Airpay does not publish /callback/... endpoints.

The instruction — "forward all callback data received at frontiva.online/… to our existing callback endpoint kkchat.in/…" — is written to whoever operates frontiva.online, asking them to relay to kkchat.in. Read plainly, this is an existing merchant/aggregator callback chain: Airpay → frontiva.online → kkchat.in. That is the plumbing of a party who already holds this MID, not Yarniva's.

This raises a live concern. Airpay's return URL is configured per-MID in the dashboard, not per-request. If those URLs are configured on AIRPAY_MID, then either (a) the MID is shared with another merchant, or (b) Yarniva is expected to consume payment results second-hand from kkchat.in. Both are material.

Recommendation: Yarniva must have its own callback endpoint on its own domain (https://<yarniva-domain>/api/payments/callback), registered against a MID Yarniva controls. Money events for Yarniva orders should not transit domains Yarniva neither owns nor audits — a compromised relay could forge a SUCCESS, and ap_SecureHash (CRC32, §14) will not stop that. If the relay must stay for the other party's reconciliation, it should run in parallel, never as Yarniva's only path.

I have sent nothing to either domain. This needs an answer before Phase 5 (§17).

12. Data Ownership
Data	Owner	In Supabase?
Products, variants, prices, Cloudinary refs	Yarniva	Yes — already
Cart	Yarniva (browser)	No — localStorage, correct as is
Line items, sizes, quantities	Yarniva	Yes — new
Shipping address	Yarniva	Yes — new
Authoritative amount	Yarniva	Yes — new
Fulfilment status	Yarniva	Yes — new
order_ref ↔ ap_transactionid ↔ payment_status	shared key	Yes — 3 columns
Payment mode, card/bank/VPA, RRN	Airpay	No
Gateway response blob, 3DS, retries	Airpay	No
Settlement, reconciliation, refunds ledger	Airpay	No
Payment reporting	Airpay dashboard	No
No airpay_transactions table. No payment mirror. Three columns on the order row.

13. Database Changes — the minimum that is genuinely required
Answering your six questions from §13 directly:

Does an order representation exist? Yes, in TypeScript — but only in localStorage.
Are persistent records needed? Yes, unavoidably — the callback is out-of-band and needs somewhere to land; the amount must be server-authoritative; and a paid order whose browser never returned would otherwise vanish.
Does Airpay already provide them? Only the payment half. Airpay has no line items, no sizes, no shipping address.
Must Yarniva know if an order is paid? Yes — you cannot dispatch otherwise.
Order history? Already exists in localStorage and can stay as the shopper-facing view. The Supabase row is the merchant's system of record.
Inventory updates? See §14.
One new table. No payments table.


create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_ref       text not null unique,          -- 'YV-…', sent to Airpay as orderid
  access_token    uuid not null default gen_random_uuid(),  -- opaque read key
  status          text not null default 'pending',
  payment_method  text not null,                 -- 'cod' | 'airpay'
  payment_status  text not null default 'pending',
                  -- pending | initiated | paid | failed | cancelled
  amount          numeric(10,2) not null check (amount >= 0),  -- THE authority
  currency        text not null default 'INR',
  address         jsonb not null,
  items           jsonb not null,                -- snapshot, mirrors OrderItem[]
  ap_transactionid text,
  ap_verified_at  timestamptz,
  inventory_applied boolean not null default false,  -- idempotency guard
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_ref_idx on public.orders (order_ref);
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();   -- reuse 0001_init

alter table public.orders enable row level security;
-- Deliberately NO policies: the anon key can neither read nor write.
-- Only SUPABASE_SERVICE_ROLE (server functions) touches this table.
That is the complete database change. It follows the conventions already in 0001_init.sql — idempotent, RLS-on, reuses set_updated_at().

14. Security
Server-side secrets. All six AIRPAY_* vars stay unprefixed and server-only. Note an inherent Airpay design property: privatekey is sha256(secret@username:|:password) and must be posted from the browser — it is a per-merchant constant that functions as a bearer credential in the hosted-page flow. This is unavoidable (Airpay's own plugins do the same). Never log it, never expose the raw inputs, and never treat its presence as authentication of anything.

Amount validation — the critical control. /api/payments/create must recompute the total from Supabase using the existing, already-correct logic (reconcileCart + calculateOrderSummary, ported to the server or shared) and ignore any client-supplied figure. At verification, AMOUNT from Airpay must equal orders.amount to the paisa, or the order is not marked paid.

Order validation. Reject if order_ref is unknown, already paid, or cancelled.

Checksum. sha256(sorted-values + date('Y-m-d')). Vercel runs UTC; Airpay's PHP reference uses server-local date. Between 00:00 and 05:30 IST the UTC date is the previous day, which will silently break checksums nightly for 5.5 hours. Format explicitly:


new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
// → 'YYYY-MM-DD'
Do not use toISOString().slice(0,10).

ap_SecureHash is CRC32. It is a non-keyed integrity check computed over values an attacker who knows MID and username can reproduce. It is not authentication. Treat a valid hash as "probably not corrupted in transit" and nothing more.

Order Confirmation is the only trustworthy source. Never mark an order paid on the strength of a redirect, a query parameter, or a callback body alone. Always call /api/verify/ server-side. Which is why the sandbox limitation in §15 is a real problem.

Callback security. Own domain only (§11). Treat the body as untrusted input, ignore the amount it claims, look up the order by orderid, then verify out-of-band. Rate-limit. Return 200 fast to avoid retry storms.

Idempotency. The callback, the return redirect, and any poll can all try to settle the same order. Guard with a conditional update — update orders set payment_status='paid' where order_ref=$1 and payment_status <> 'paid' — and gate inventory on inventory_applied = false.

Replay protection. order_ref is single-use: once paid, later verifications are read-only. Airpay's access_token lives 300s, which naturally bounds initiation replay.

Existing note: generateOrderId() uses Math.random() — fine for a display reference, unsuitable as a security value. Generate order_ref server-side with crypto.randomUUID()-derived entropy once it identifies real money.

15. Sandbox / Production
I cannot determine whether your MID is sandbox or live — the value is in .env and I did not read it, and Airpay does not encode the environment in the MID format. This must be confirmed with Airpay or the client.

It matters more than usual, because of one documented constraint:

"This API will work only on live MID, for the sandbox MID this API will not work." — Order Confirmation API

So on a sandbox MID, the trusted verification step is unavailable. Testing options:

Sandbox — exercise OAuth2, encryption, checksum, form POST, hosted page render, redirect handling and ap_SecureHash parsing. Behind a flag, allow the callback to settle orders in sandbox mode only, with a loud log line.
Live, low value — a ₹1–2 real transaction on the live MID is the only way to prove the end-to-end verified path. Plan for this in Phase 8; refund via the dashboard.
Both hosts (kraken.airpay.co.in, payments.airpay.co.in) appear in the docs without separate sandbox subdomains — the environment is selected by MID and credentials, so confirm whether a distinct sandbox host or credential set is issued.
16. Implementation Phases
Phase 1 — Payment backend foundation
Files: new api/_lib/env.ts, api/_lib/db.ts; modify .env.example, vercel.json, tsconfig.node.json (include api/).
Changes: zod-validated server env mirroring src/lib/env.ts; service-role Supabase client; exclude /api/ from the SPA rewrite.
Depends on: nothing.
Test: a throwaway api/health.ts returning { ok: true }; confirm vercel dev serves it and that /shop still resolves to the SPA.

Phase 2 — Airpay OAuth
Files: new api/_lib/airpay.ts.
Changes: encrypt() (AES-256-CBC, key md5(user~:~pass), 16-char hex IV prefix, base64 body), checksum() (ksort → concat values → + IST date → sha256), privateKey(), getAccessToken() with a ~4-minute in-memory cache under the 300s TTL.
Depends on: Phase 1.
Test: unit-test encrypt/checksum against the doc examples offline first. Then one real OAuth call — the only Airpay request before Phase 8. Error 903 means bad credentials, which would immediately settle the §17 ambiguity.

Phase 3 — Airpay payment initiation
Files: new supabase/migrations/0003_orders.sql, api/payments/create.ts, api/_lib/pricing.ts; refactor src/utils/cart.ts pure functions into shared code.
Changes: create the orders table; server re-prices from Supabase; insert initiated row; return the four signed form fields plus action_url.
Depends on: Phase 2. Requires the migration to be run manually in the Supabase SQL editor, matching your existing workflow.
Test: curl /api/payments/create with a real product id; assert the returned amount matches effective_price × qty + shipping, and that a deliberately inflated client total is ignored.

Phase 4 — Redirect / checkout
Files: PaymentCard.tsx (COD/Online radio group), CheckoutPage.tsx, src/types/order.ts (paymentMethod: 'cod' | 'airpay'), src/lib/orderStorage.ts (widen the z.literal('cod')), new src/services/payment.ts.
Changes: COD keeps its current path unchanged; online posts an auto-submitting hidden form to action_url.
Depends on: Phase 3.
Test: with sandbox credentials, confirm the Airpay hosted page renders with the correct amount. Confirm the COD flow is byte-for-byte unchanged. Note the storage-schema widening is backward-compatible — existing 'cod' orders still parse.

Phase 5 — Callback
Files: new api/payments/callback.ts, api/payments/return.ts.
Changes: parse the posted fields, verify ap_SecureHash, look up by orderid, record the attempt; redirect the browser to /order-success?ref=…&t=….
Depends on: Phase 4 and a resolved answer to §11 and Q1 in §17. Do not register any callback URL until the domain ownership question is settled.
Test: replay a synthetic Airpay payload against localhost. Verify a tampered AMOUNT fails the hash check and a forged SUCCESS with a valid hash still does not mark the order paid (because Phase 6 is the gate).

Phase 6 — Payment verification
Files: new api/payments/verify.ts (internal), extend api/_lib/airpay.ts.
Changes: call /api/verify/, compare amount to orders.amount, map transaction_status (200/211/400) → payment_status, conditional-update for idempotency.
Depends on: Phase 5, and a live MID (§15).
Test: the double-callback case must settle exactly once. 211 INPROCESS must leave the order unsettled and pollable.

Phase 7 — Order synchronization
Files: new api/orders/[ref].ts; modify OrderSuccessPage.tsx, OrdersPage.tsx, OrderDetailPage.tsx.
Changes: success page reads authoritative status via ?ref=&t=, polls while INPROCESS, and renders a "payment pending" state rather than a false success. localStorage stays as the shopper's history cache; the server is truth. Also decide COD parity here — COD orders should start being written to the table too, since the endpoint now exists.
Depends on: Phase 6.
Test: clear localStorage and reload /order-success?ref=…&t=… — it must still render correctly. It cannot today.

Phase 8 — Testing
Changes: full matrix — success, failure, user-abandons, browser closed before redirect (callback-only settlement), duplicate callback, amount tampering, expired token, 00:30 IST checksum boundary. One real low-value live transaction.
Depends on: Phase 7.
Test: each case must leave orders.payment_status in exactly one correct terminal state.

Phase 9 — Production
Changes: live credentials in Vercel production scope; register the production return + callback URLs with Airpay; add a structured log line per state transition; document the manual reconciliation procedure (Airpay dashboard orderid ↔ orders.order_ref).
Depends on: Phase 8.
Test: one live transaction end-to-end, then refund it from the dashboard.

Inventory (§14) is deliberately absent from these phases. The correct point is on verified payment success for online (and on placement for COD) — inside the same guarded update that sets payment_status='paid', gated on inventory_applied = false. But nothing decrements products.variants today, track_quantity is unused, and a correct implementation needs a Postgres function with row locking to mutate the jsonb array safely. That is a separate piece of work with its own oversell semantics, and bolting it onto the payment integration would risk both. Recommend Phase 10, after Airpay is stable.

17. Open Questions
Genuine unknowns only:

Who owns frontiva.online and kkchat.in, and are those URLs already configured on AIRPAY_MID? (§11) If yes, the MID is shared and that must be resolved before go-live. Blocks Phase 5.
Is AIRPAY_MID sandbox or live? (§15) Determines whether Phase 6 can be tested at all. Blocks Phase 6.
In privatekey = sha256($secret . '@' . $username . ':|:' . $password), is $secret AIRPAY_SECRET_KEY or AIRPAY_API_KEY? The client confirmed API_KEY → client_secret for OAuth, which strongly implies SECRET_KEY is the privatekey $secret — the two credentials would otherwise be redundant. Cheap to settle empirically in Phase 2. Blocks Phase 3.
Is the AES key md5(username~:~password) or a variant using SECRET_KEY? The encryption page states the former; the transaction sample passes an unexplained $secretKey. Settled by the first successful OAuth call.
Can the return URL be supplied per-transaction, or is it dashboard-configured only? The docs say "configured at airpay". If per-MID only, Yarniva needs its own MID (see Q1).
Should COD orders also be persisted to Supabase? I recommend yes — the merchant currently cannot see COD orders either — but it is scope beyond Airpay and is your call. Phase 7 is the natural place.
Is a distinct sandbox hostname issued, or is the environment selected purely by MID/credentials?
18. FINAL EXECUTION CHECKLIST

□  0.  Answer Q1–Q3 in §17 (callback ownership, MID environment, $secret mapping)
□  1.  Add AIRPAY_* keys to .env.example; set all six in Vercel (server scope)
□  2.  Fix the vercel.json rewrite to exclude /api/
□  3.  Add api/_lib/env.ts + api/_lib/db.ts; verify with a throwaway health route
□  4.  Implement api/_lib/airpay.ts — encrypt, checksum (IST date), privatekey
□  5.  Unit-test encrypt/checksum offline against the documented samples
□  6.  One real OAuth2 call — confirms credential mapping
□  7.  Write supabase/migrations/0003_orders.sql; run it in the SQL editor
□  8.  Build api/payments/create.ts — server re-prices, never trusts the client
□  9.  Verify a tampered client total is ignored
□  10. Add the COD/Online selector; auto-submit form to Airpay
□  11. Confirm the COD path is completely unchanged
□  12. Register Yarniva's OWN callback + return URLs (only after step 0)
□  13. Build callback.ts + return.ts with ap_SecureHash verification
□  14. Build verify.ts — Order Confirmation + amount comparison + idempotent update
□  15. Build api/orders/[ref].ts; wire Order Success to poll it
□  16. Run the full failure matrix (§ Phase 8), including the 00:30 IST boundary
□  17. One live low-value transaction; refund it
□  18. Go live; add reconciliation logging
□  19. LATER — inventory decrement on verified payment (separate phase)
Stopping here as instructed. No code modified, no files created, no packages installed, no Supabase or Vercel changes, no Airpay requests beyond reading public documentation, no data sent to either callback URL.

The three things I'd flag as most consequential: the localStorage-only order model is the sole blocking gap (§4); the callback domain ownership is unresolved and touches money integrity (§11); and the Order Confirmation sandbox limitation means the trusted verification path cannot be proven without a live MID (§15).

Sources: Airpay Developer Docs, OAuth2, Simple Transaction, Encryption, Checksum, Order Confirmation, Webhooks & Order Confirmation PDF v1.5, reference plugin implementation.
---

# CORRECTION NOTE — appended after implementation

**This document is the historical approved plan and has deliberately not been
rewritten.** Sections 11 and 17 above reason at length about
`frontiva.online/callback/cpm/arp/collection` and
`kkchat.in/callback/cpm/arp/collection`, and treat the relationship between them
and Yarnvia as an open question. That question has since been answered, and the
answer changes the conclusion.

## Those URLs are not part of Yarnvia's architecture

They belong to a **different, existing integration**. They were supplied early in
the project and were mistakenly carried into the Airpay planning as though they
were Yarnvia's callback chain. They are not.

Accordingly, the architecture described in §11 —

    Airpay → frontiva.online → kkchat.in → (somehow) Yarnvia

**is not, and never was, Yarnvia's payment flow.** Nothing in the delivered
codebase builds, calls, forwards to, proxies through or depends on either
domain, and no request has ever been sent to either.

## What the final architecture is

Yarnvia-native and self-contained, with Airpay as the only external party:

    Yarnvia Checkout
         ↓
    POST /api/payments/create          server re-prices, inserts order, signs
         ↓
    Airpay Hosted Checkout
         ↓
    Customer completes payment
         ↓
    Airpay IPN  → /api/payments/callback        (server to server)
    Airpay return → /api/payments/return        (browser)
         ↓
    Airpay Order Confirmation API      ← the sole proof of payment
         ↓
    Amount verified against orders.amount
         ↓
    Idempotent Supabase settlement
         ↓
    /order-success renders the verified status

Both endpoints are Yarnvia's own and must be registered against Yarnvia's Airpay
MID. Airpay resolves them per-MID from its dashboard; the Simple Transaction
request carries no URL parameter, so they cannot be supplied per transaction.

## What still holds from this plan

Everything else. The server-side re-pricing, the refusal to trust a redirect or
a callback body, Order Confirmation as the only authority, amount comparison
against the server-derived figure, conditional-update idempotency, IST date
handling, and the minimal one-table schema were all implemented as specified and
verified against the live gateway.

## Corrections to §8 and §17 established empirically

The credential mapping in §8 was wrong in both directions. Verified against the
live gateway:

| Credential | Actual role |
| --- | --- |
| `AIRPAY_SECRET_KEY` | OAuth2 `client_secret` |
| `AIRPAY_API_KEY` | the `secret` in the privatekey derivation |

This resolves §17 Q3, and reverses the merchant-stated mapping recorded in §8.

§17 Q1 (callback ownership) is answered by this note. §17 Q5 is answered: the
return URL is dashboard-configured only, with no per-transaction override.
