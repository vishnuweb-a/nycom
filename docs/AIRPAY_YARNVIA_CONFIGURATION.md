# Airpay Configuration — Yarnvia

Environment, credentials, dashboard settings and routing for the Airpay
integration on MID **366950**.

**No secret value appears in this document, and none may ever be added to it.**
Only variable *names*, formats and roles are recorded.

Evidence tags: **PROVEN** (from source) · **OBSERVED** (seen from live Airpay) ·
**INFERRED** · **UNKNOWN**.

Companions: [Architecture](AIRPAY_YARNVIA_ARCHITECTURE.md) ·
[Verification](AIRPAY_YARNVIA_VERIFICATION.md) ·
[Implementation plan](AIRPAY_YARNVIA_IMPLEMENTATION_PLAN.md)

---

## 1. THE NAMING TRAP — read this before touching anything

> ### `AIRPAY_SECRET_KEY` = OAuth `client_secret`
> ### `AIRPAY_API_KEY` = `privatekey` derivation secret
>
> **Do not swap them.**

Both names sound like "the secret". They are used in exactly one role each, and
in no other place:

| Variable | Its one and only use | Where |
| --- | --- | --- |
| `AIRPAY_SECRET_KEY` | The `client_secret` field inside the OAuth `encdata` payload | `getAccessToken()` in `api/_lib/airpay.ts` |
| `AIRPAY_API_KEY` | The `secret` in `sha256(secret + "@" + USERNAME + ":\|:" + PASSWORD)` | `privateKey()` in `api/_lib/airpay.ts` |

### 1.1 How this was established — empirically, against the live gateway

**OBSERVED.** The merchant originally stated the *opposite* mapping, and the code
originally implemented it that way. The live gateway rejected it:

| Attempt | Airpay's answer |
| --- | --- |
| `client_secret = AIRPAY_API_KEY` | `data.success: false`, `data.msg: "Invalid client id or secret"` |
| `client_secret = AIRPAY_SECRET_KEY` | **token issued** |
| `privatekey = sha256(AIRPAY_SECRET_KEY@...)` | `"Merchant Key Authentication Failed"` at the hosted page |
| `privatekey = sha256(AIRPAY_API_KEY@...)` | `"Invalid Domain"` — *progress*: the key was accepted and the request advanced to the domain check |

The result held across url-encoded and multipart bodies and both URL forms, so
the credential was the only variable that mattered. A live gateway saying yes to
one value and no to the other is stronger evidence than either the documentation
or the merchant's recollection.

The Frontiva codebase reached the same mapping independently and carries a
dedicated regression test asserting that `privatekey` is derived from `API_KEY`
and explicitly **not** from `SECRET_KEY`. **PROVEN.**

### 1.2 How a swap presents itself

| Symptom | Suspect |
| --- | --- |
| OAuth returns `data.msg: "Invalid client id or secret"`, or Airpay error **903** | `AIRPAY_SECRET_KEY` / `AIRPAY_CLIENT_ID` |
| Hosted page shows **"Merchant Key Authentication Failed"** | `AIRPAY_API_KEY` used where `SECRET_KEY` belongs, or vice versa |
| Hosted page shows **"Invalid Domain"** | Key accepted; the *domain registration* is the problem — see section 5 |

---

## 2. Environment variables

All server-side. **None may ever carry a `VITE_` prefix** — anything
`VITE_`-prefixed is inlined into the browser bundle and would publish the
credential to every visitor. Validated by a Zod schema in `api/_lib/env.ts`,
parsed **lazily** so a missing variable fails the one request that needs it
rather than crashing every function including the health check you would use to
diagnose it. **PROVEN.**

### 2.1 Airpay credentials — all required

| Variable | Group | Purpose | Format |
| --- | --- | --- | --- |
| `AIRPAY_MID` | Identity | Merchant ID. Sent in the clear as a form field on every envelope, and inside `encdata`. Also an input to the CRC32 `ap_SecureHash` | Numeric string. **`366950` for Yarnvia.** **PROVEN** |
| `AIRPAY_CLIENT_ID` | **OAuth** | The `client_id` inside the OAuth `encdata` | Opaque string. Length **UNKNOWN** |
| `AIRPAY_SECRET_KEY` | **OAuth** | The `client_secret` inside the OAuth `encdata`. **Not** the privatekey secret | Opaque string. Length **UNKNOWN** |
| `AIRPAY_API_KEY` | **Crypto / verification** | The `secret` in the `privatekey` derivation. **Not** the OAuth secret | Opaque string. Length **UNKNOWN** |
| `AIRPAY_USERNAME` | **Crypto** | Input to *both* the AES key (`md5(USERNAME~:~PASSWORD)`) and `privatekey`. Also an input to the CRC32 `ap_SecureHash` | Opaque string |
| `AIRPAY_PASSWORD` | **Crypto** | Input to *both* the AES key and `privatekey` | Opaque string |
| `AIRPAY_ENV` | Behaviour | `live` \| `sandbox`. **Explicit, never inferred** — Order Confirmation works only against a live MID, and that single fact decides whether a payment can be trusted at all | Exactly `live` or `sandbox`; anything else fails Zod validation. **PROVEN** |

### 2.2 Which group does what

```
   OAuth credentials              Crypto credentials           Verification
   ─────────────────              ──────────────────           ────────────
   AIRPAY_CLIENT_ID  ─┐           AIRPAY_USERNAME ─┬─► AES key   AIRPAY_API_KEY ─┐
   AIRPAY_SECRET_KEY ─┼─► encdata AIRPAY_PASSWORD ─┘   (md5)     AIRPAY_USERNAME ─┼─► privatekey
   AIRPAY_MID        ─┘   payload                                AIRPAY_PASSWORD ─┘   (sha256)
   grant_type        ─┘                                                    │
                                                                           ▼
                                        sent on every TRANSACTIONAL call
                                        (hosted page, Order Confirmation),
                                        never on OAuth
```

Note the overlap: `AIRPAY_USERNAME` and `AIRPAY_PASSWORD` are **both** crypto
inputs (the AES key) **and** verification inputs (`privatekey`). `AIRPAY_MID` and
`AIRPAY_USERNAME` are additionally inputs to the CRC32 `ap_SecureHash`. **PROVEN.**

### 2.3 Format and length — what is and is not proven

**PROVEN:**

- `AIRPAY_MID` is a numeric string; `366950` is the value for Yarnvia.
- `AIRPAY_ENV` accepts exactly `live` or `sandbox`.
- Every one of the seven is validated as a non-empty string; the process refuses
  to start a payment if any is missing, naming only the *variable names* in the
  error.

**Derived values, not stored ones** — these are computed and always have a fixed
shape:

| Derived value | Shape |
| --- | --- |
| AES key | 32 lowercase hex characters, used as 32 ASCII bytes |
| IV | 16 lowercase hex characters, used as 16 ASCII bytes |
| `privatekey` | 64 lowercase hex characters (SHA-256) |
| `checksum` | 64 lowercase hex characters (SHA-256) |
| `ap_SecureHash` | Unsigned decimal string (CRC-32) |
| `encdata` | 16 hex chars + base64, no delimiter |

**UNKNOWN:** the expected length or character set of `AIRPAY_CLIENT_ID`,
`AIRPAY_SECRET_KEY`, `AIRPAY_API_KEY`, `AIRPAY_USERNAME` or `AIRPAY_PASSWORD`.
Neither codebase asserts a length, and no captured example exists. **Do not add
a length check based on the values you happen to hold** — you would be encoding
one merchant's accident as a rule.

### 2.4 Infrastructure variables

| Variable | Required? | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | **Yes** | Project URL. `VITE_SUPABASE_URL` is accepted as a fallback — the project URL is not a secret, so forcing a duplicate variable would be noise. **PROVEN** |
| `SUPABASE_SERVICE_ROLE` | **Yes** | Bypasses RLS entirely. The `orders` table has RLS enabled with **no policies**, so this is the only key that can reach it. Must never be exposed to the browser |
| `PUBLIC_SITE_ORIGIN` | Recommended | Absolute origin used to build the post-payment redirect. Falls back to `x-forwarded-host`, then `host`. **Must have no trailing slash** — the code strips one but do not rely on it |
| `CRON_SECRET` | **Yes** | Bearer token for `/api/payments/reconcile`. Required, not optional: that endpoint triggers outbound Order Confirmation calls against the live MID, so leaving it open would let anyone drive traffic there. Compared in constant time; **unset denies** rather than allows. **PROVEN** |
| `KKCHAT_CALLBACK_URL` | Optional | Overrides the relay destination. Unset uses the built-in constant. `off` or `disabled` switches relaying off entirely. Deliberately read from `process.env` directly, not through the validated schema, so the relay stays decoupled from the payment credential schema and a misconfiguration on either side cannot take the other down. **PROVEN** |

### 2.5 Platform-injected — read, never set

| Variable | Used for |
| --- | --- |
| `VERCEL_GIT_COMMIT_SHA` | `/api/health` reports the first 7 characters, so "is my fix deployed?" is one request rather than correlating dashboard timestamps against log windows by hand. Requires "Automatically expose System Environment Variables" to be enabled. **PROVEN** |

### 2.6 Not used by the payment tier

`VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`,
`VITE_CLOUDINARY_UPLOAD_PRESET` are browser-side and public by design.
`CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` are for local seeding scripts only
and must **not** be added to Vercel.

### 2.7 Frontiva variables Yarnvia does not have

| Frontiva variable | Purpose | Should Yarnvia adopt it? |
| --- | --- | --- |
| `AIRPAY_VERIFY_URL` | Overrides the Order Confirmation endpoint without a deploy | **Yes — strongly.** With the Order Confirmation defect open (Verification section 4.2), being able to switch between `/api/verify/` and `/api/orderconfirmation/` by changing an environment variable turns a multi-deploy investigation into a one-minute test |
| `AIRPAY_ENFORCE_SECURE_HASH` | Makes an `ap_SecureHash` mismatch blocking | **No.** Yarnvia's CRC32 construction is transcribed from Airpay's documentation and already blocks; a flag to weaken it would be a step backwards |
| `AIRPAY_FALLBACK_BUYER_EMAIL` | Stands in when checkout collects no email | **No.** Yarnvia's checkout collects a real email (`addressSchema`), so there is nothing to fall back to |

---

## 3. Vercel environment requirements

### 3.1 Where each variable goes

| Variable | Vercel scope | Notes |
| --- | --- | --- |
| `AIRPAY_MID` … `AIRPAY_ENV` (7 vars) | **Production** | Add Preview only with sandbox credentials, if a sandbox MID exists at all |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` | Production (+ Preview) | Service role is a full-database key |
| `PUBLIC_SITE_ORIGIN` | Production | Leave unset on Preview so each preview resolves to itself |
| `CRON_SECRET` | Production | Vercel sets this automatically when added as a project environment variable, and presents it to cron invocations |
| `KKCHAT_CALLBACK_URL` | Optional | Recommended: set to `off` on Preview so preview deployments never POST to the merchant's live endpoint |

### 3.2 Redeployment is required after any change

Environment variables are bound at build/deploy time. Changing one in the Vercel
dashboard does **not** affect running functions until a redeploy. Confirm with
`/api/health`, which reports the serving commit.

### 3.3 Function configuration

| Item | Value | Source |
| --- | --- | --- |
| Framework | `vite` | `vercel.json` |
| Build command | `npm run build` | `vercel.json` |
| Output directory | `dist` | `vercel.json` |
| Cron | `/api/payments/reconcile` at `0 3 * * *` (08:30 IST) | `vercel.json` |
| `maxDuration` | **Not declared on any function** — platform default (10 s on Hobby) | **PROVEN** |

> **The 10-second budget is why the Airpay timeout is 8 s, not 15 s.** At 15 s the
> abort could never fire first: a hung gateway would get the whole function killed
> by the platform, producing a bare 502 **and no log at all**, because the catch
> block never runs. Frontiva raises `maxDuration` to 60 s on its callback and
> reconcile functions instead; Yarnvia does not, and its shorter timeout is the
> correct compensation. **PROVEN.**
>
> If Yarnvia ever moves to a plan allowing longer functions, raise
> `maxDuration` **and** the Airpay timeout together, or neither.

### 3.4 Cron cadence is plan-limited

The Hobby plan permits cron **once per day**, and `vercel.json` is set
accordingly (`0 3 * * *`). Consequences, spelled out in the source:

- A shopper who pays and **closes the tab** may wait up to a day for their order
  to settle.
- A shopper who **stays on the success page** is unaffected — their poll settles
  immediately.
- `MAX_AGE_MS` is 7 days rather than 24 hours precisely so an order created
  shortly after one run cannot pass 24 hours before the next, drop out of the
  window, and never be settled at all.
- On Pro, a 15-minute schedule closes the gap; the sweep is sized to tolerate
  either cadence.

**PROVEN.**

---

## 4. Airpay endpoints

| Role | URL | Configurable? |
| --- | --- | --- |
| OAuth2 token | `https://kraken.airpay.co.in/airpay/pay/v4/api/oauth2/` | No — module constant |
| Hosted payment page | `https://payments.airpay.co.in/pay/v4/` (+ `?token=`) | No — module constant |
| Order Confirmation | Yarnvia: `https://kraken.airpay.co.in/airpay/pay/v4/api/verify/` | **No** — hard-coded |
| Order Confirmation | Frontiva: `https://kraken.airpay.co.in/airpay/pay/v4/api/orderconfirmation/` | Yes, via `AIRPAY_VERIFY_URL` |

**The two projects call different paths.** See
[Verification section 4.2](AIRPAY_YARNVIA_VERIFICATION.md) — this is an open
defect, not a stylistic difference.

Yarnvia's URLs:

| Role | URL |
| --- | --- |
| Response URL **and** IPN URL | `https://www.yarnvia.online/callback/cpm/arp/collection` |
| Payment initiation (internal) | `https://www.yarnvia.online/api/payments/create` |
| Order status (internal) | `https://www.yarnvia.online/api/orders/:ref?t=` |
| Reconciliation (cron-authenticated) | `https://www.yarnvia.online/api/payments/reconcile` |
| Health | `https://www.yarnvia.online/api/health` |
| Legacy IPN alias (internal) | `https://www.yarnvia.online/api/payments/callback` |
| Legacy return alias (internal) | `https://www.yarnvia.online/api/payments/return` |

---

## 5. Production vs sandbox

| | Frontiva | Yarnvia |
| --- | --- | --- |
| Sandbox code path | **None.** `AIRPAY_ENV` is read and echoed but never branched on | **Yes.** `isLiveMid()` gates Order Confirmation |
| Sandbox behaviour | Would silently use production hosts | Returns `unverifiable`, leaves the order unsettled, **refuses to mark it paid** |
| Sandbox hosts | Not determinable | Not determinable |

Airpay's documented constraint: *"This API will work only on live MID, for the
sandbox MID this API will not work."* Since Order Confirmation is the **only**
thing that may mark an order paid, **no order can settle on a sandbox MID**, by
design. Yarnvia's refusal is deliberate:

> a sandbox convenience flag here would be the exact hole this module exists to
> close, and it would ship to production the first time someone mis-set
> `AIRPAY_ENV`.

**PROVEN.**

**UNKNOWN:** Airpay's sandbox hostnames, whether a sandbox MID exists for
Yarnvia at all, and any sandbox-specific payload differences. The endpoint
constants are hard-coded production hosts in both projects; switching would
require a code change, not just an environment variable.

---

## 6. Domain registration and dashboard settings

### 6.1 The values that must match

| Setting | Value |
| --- | --- |
| MID | `366950` |
| Domain URL | `https://www.yarnvia.online` |
| Response URL (Success/Failed) | `https://www.yarnvia.online/callback/cpm/arp/collection` |
| IPN URL (Webhook) | `https://www.yarnvia.online/callback/cpm/arp/collection` |
| KKChat relay destination (outbound, **not** an Airpay setting) | `https://kkchat.in/callback/cpm/arp/collection` |

### 6.2 Domain registration is a hard requirement

**Airpay validates the domain the request originates from against the domain
registered on the MID.** A mismatch produces **"Invalid Domain"** at the hosted
page. This is a dashboard/registration issue and — quoting Frontiva's deployment
guide — *"cannot and must not be worked around in application code."*

> ### `www` vs apex is not cosmetic
>
> Frontiva registered the **apex** (`https://frontiva.online`) and its source
> carries an explicit warning that `www.frontiva.online` would be a *different
> origin* and would be rejected.
>
> Yarnvia's supplied configuration uses **`www`**
> (`https://www.yarnvia.online`). That is fine — but it must be consistent
> everywhere:
>
> - `PUBLIC_SITE_ORIGIN` must be `https://www.yarnvia.online`, with no trailing
>   slash.
> - The Airpay dashboard Domain URL must be `https://www.yarnvia.online`.
> - The site must actually **serve** `www` as canonical. If it 301-redirects
>   `www` → apex, Airpay will see the apex and reject it.
>
> Do not mix the two forms. Pick `www`, per the supplied configuration, and make
> all three agree.

**PROVEN** (Frontiva's apex warning); **INFERRED** (that the same rule applies in
the `www` direction — it follows from origin matching, but Yarnvia has not
observed an "Invalid Domain" rejection on `www`).

**Note — the deployment guide records a conflicting origin.**
`docs/AIRPAY_YARNIVA_DEPLOYMENT.md` section 18 states that `PUBLIC_SITE_ORIGIN`,
`src/constants/app.ts` and the `index.html` canonical all currently read
`https://yarnvia.vercel.app`, while `src/constants/company.ts` cites
`yarnvia.online` in the legal copy. **Resolve this before the first live payment
on the new domain** — Airpay validating against a Vercel default domain while the
dashboard names `www.yarnvia.online` will fail. All four places change together.

### 6.3 Confirm with Airpay support

1. **The MID is provisioned for `www.yarnvia.online`.**
2. **The MID is enabled for the Order Confirmation API.** Without it **no order
   can ever be marked paid** — every settlement lands in the reviewable state.
   This is the single most important dashboard prerequisite.
3. **Which key Order Confirmation responses are encrypted under** — see
   [Verification section 4.2](AIRPAY_YARNVIA_VERIFICATION.md). This is the open
   blocker.
4. **Whether MID 366950 is shared.** The `/callback/cpm/arp/collection` path
   registered against it is the same path the earlier Frontiva/KKChat integration
   used, which suggests the MID may already serve another merchant. Since both
   URLs are per-MID, a shared MID may mean Yarnvia needs its own. **UNCONFIRMED**,
   recorded as blocker 2 in the deployment guide.
5. **The IPN content type.** Form-encoded POST is assumed; JSON is also handled.
6. **The full transaction status-code set**, in particular what `210` means —
   Yarnvia currently classifies it as a failure while Frontiva classifies it as
   pending.

### 6.4 There is no webhook registration API

No code anywhere registers the IPN URL. It is a **MID-level dashboard setting**
and must be configured there. No signature-verification secret is registered on
Yarnvia's side either — inbound authenticity relies on the CRC32 integrity check
and, ultimately, on server-to-server re-verification. **PROVEN.**

---

## 7. Routing requirements

> **Airpay's public callback URL must resolve to a real serverless function
> BEFORE the SPA catch-all rewrite. It must not become `index.html`.**

`vercel.json` currently satisfies this. **It is not modified by this task.**

```json
"rewrites": [
  { "source": "/callback/cpm/arp/collection",  "destination": "/api/callback/cpm/arp/collection" },
  { "source": "/callback/cpm/arp/collection/", "destination": "/api/callback/cpm/arp/collection" },
  { "source": "/((?!api/).*)",                 "destination": "/index.html" }
]
```

Rules for anyone editing this file later:

1. **Never move the callback rewrites below the catch-all.** Vercel takes the
   first match, top-down. Reordering silently breaks payments — the symptom is
   `index.html` returned to Airpay and a 405 on POST, which is exactly what
   stranded order `YV-3200A-2AB47227`.
2. **Never remove the `(?!api/)` negative lookahead** from the catch-all, or add
   a rule above it that captures `/api/*`.
3. **Keep the trailing-slash variant.** A proxy or redirect can add one.
4. The `/api` prefix in the *destination* is a Vercel filesystem requirement, not
   a change to the public contract. Airpay still calls the un-prefixed path.

Also configured, and unrelated to payments but worth not breaking:
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy`, and immutable caching on `/assets/*`.

---

## 8. Database configuration

Apply `supabase/migrations/0003_orders.sql` in the Supabase SQL Editor. It is
idempotent and safe to re-run.

> **Per `docs/AIRPAY_YARNIVA_DEPLOYMENT.md` section 11 this migration is NOT
> APPLIED in production.** It must be applied before the first payment. Not
> verified by this task — confirm directly against the database.

Two gotchas recorded in the existing documentation:

1. **`supabase/setup.sql` is stale** and would create the `payment_status`
   constraint **without** `requires_review`. Use the numbered migrations, or
   regenerate `setup.sql` first.
2. **PostgREST caches the table schema.** Frontiva's migration ends with
   `notify pgrst, 'reload schema'` because Supabase's API layer otherwise keeps
   reporting *"Could not find the 'payment_status' column of 'orders' in the
   schema cache"*. Yarnvia's migration does **not** include that line. If a
   post-migration request reports a missing column, this is why.

RLS: enabled on `public.orders` with **deliberately no policies**, so the anon
key in the browser bundle can neither read nor write an order. Only
`SUPABASE_SERVICE_ROLE` reaches it. **PROVEN.**

---

## 9. Operational reference

### 9.1 Timeouts

| Call | Timeout | Where |
| --- | --- | --- |
| Airpay OAuth | 8 000 ms | `HTTP_TIMEOUT_MS`, `api/_lib/airpay.ts` |
| Airpay Order Confirmation | 8 000 ms | same |
| KKChat relay | 5 000 ms | `RELAY_TIMEOUT_MS`, `api/_lib/relay.ts` |
| Function budget | Platform default (10 s on Hobby) | not declared |

### 9.2 Limits

| Limit | Value | Where |
| --- | --- | --- |
| Max lines per order | 50 | `pricing.ts` / `create.ts` schema |
| Max quantity per line | 20 | both |
| Relay max fields | 64 | `relay.ts` |
| Relay max value length | 1 024 chars | `relay.ts` |
| Reconcile min order age | 5 minutes | `reconcile.ts` |
| Reconcile max order age | 7 days | `reconcile.ts` |
| Reconcile batch size | 50 | `reconcile.ts` |
| Success-page poll interval | 3 000 ms | `useOnlinePaymentStatus.ts` |
| Success-page max attempts | 20 (~60 s) | same |
| OAuth token safety margin | 60 s, floor 30 s | `airpay.ts` |
| OAuth expiry fallback | 300 s | `airpay.ts` |

### 9.3 Log events to watch

| Event | Meaning |
| --- | --- |
| `airpay.oauth.unreachable` / `.http_error` / `.no_token` | OAuth trouble. `.no_token` carries `envelopeDecrypted` and `shape` |
| `airpay.verify.unreachable` / `.http_error` / `.unparseable` / `.no_status` | **The current blocker lives here.** `envelopeDecrypted` separates a decryption problem from a field-naming one |
| `payment.initiated` | Order written, customer heading to Airpay |
| `payment.callback.received` / `.unparseable` / `.unknown_order` / `.duplicate` / `.hash_mismatch` | Inbound callback lifecycle |
| `payment.callback.browser_return` | Browser leg landed |
| `payment.verify.skipped_sandbox` / `.inconclusive` / `.in_process` / `.no_status` / `.amount_mismatch` | Settlement decisions |
| `payment.settled.paid` / `.failed` / `.cancelled` / `.race_lost` | Terminal transitions |
| `payment.transition.failed` | Database write failed |
| `payment.callback.forward.start` / `.success` / `.rejected` / `.failed` | KKChat relay |
| `payment.reconcile.swept` | Cron summary |
| `health.env_incomplete` | Names the missing variables — server log only |

### 9.4 Redaction

`api/_lib/log.ts` redacts credential-shaped field names as a backstop; the
primary defence is simply not passing them. Airpay error bodies are never logged
raw — an Airpay error can echo the submitted request, which would put `encdata`,
and therefore the credentials inside it, into the log. Only four named scalar
keys are read, each truncated to 200 characters. `describeShape()` logs key names
only. The relay logs a field *count*, never field values.

> **If Yarnvia ever starts persisting callback payloads** (Phase 1 of the plan),
> carry over Frontiva's hard-won detail: a real Airpay IPN sends
> `CUSTOMERPHONE`, `CUSTOMEREMAIL` and `CUSTOMERVPA` with **no separator**, and a
> redaction list containing only the punctuated spellings lets live customer PII
> straight through. **PROVEN** from Frontiva's source and tests.

---

## 10. Configuration checklist

**Airpay dashboard**

- [ ] MID `366950` provisioned for domain `https://www.yarnvia.online`
- [ ] Response URL = `https://www.yarnvia.online/callback/cpm/arp/collection`
- [ ] IPN URL = `https://www.yarnvia.online/callback/cpm/arp/collection`
- [ ] **Order Confirmation API enabled on this MID** (blocking prerequisite)
- [ ] Confirmed whether the MID is shared with another merchant
- [ ] Asked which key Order Confirmation responses are encrypted under
- [ ] Asked for the full transaction status-code set

**Vercel → Environment Variables (Production)**

- [ ] `AIRPAY_MID` = `366950`
- [ ] `AIRPAY_CLIENT_ID`
- [ ] `AIRPAY_SECRET_KEY` — **the OAuth client_secret**
- [ ] `AIRPAY_API_KEY` — **the privatekey secret**
- [ ] `AIRPAY_USERNAME`
- [ ] `AIRPAY_PASSWORD`
- [ ] `AIRPAY_ENV` = `live`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE`
- [ ] `PUBLIC_SITE_ORIGIN` = `https://www.yarnvia.online` (no trailing slash)
- [ ] `CRON_SECRET`
- [ ] `KKCHAT_CALLBACK_URL` — unset for production, `off` on Preview
- [ ] No variable above carries a `VITE_` prefix
- [ ] Redeployed after the last change

**Domain**

- [ ] `www.yarnvia.online` resolves to the Vercel project
- [ ] `www` is served as canonical (no 301 to apex)
- [ ] `PUBLIC_SITE_ORIGIN`, `src/constants/app.ts` and the `index.html` canonical
      all agree with the dashboard Domain URL

**Database**

- [ ] `supabase/migrations/0003_orders.sql` applied
- [ ] `payment_status` CHECK includes `requires_review`
- [ ] RLS enabled on `public.orders` with no policies
- [ ] PostgREST schema cache reloaded

**Routing**

- [ ] `POST /callback/cpm/arp/collection` returns JSON, not HTML
- [ ] `GET /callback/cpm/arp/collection` with a browser `Accept` returns 303, not HTML
- [ ] `GET /api/health` returns `{"ok":true,"configured":true,"airpayEnv":"live", ...}`
- [ ] `GET /api/payments/reconcile` without a bearer token returns 404
