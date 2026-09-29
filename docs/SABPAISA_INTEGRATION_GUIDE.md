# SabPaisa PG 3.0 — integration and go-live guide

Written for: whoever deploys and activates this integration, and whoever debugs
it later.

This documents the SabPaisa integration added alongside the existing Airpay one.
Airpay is untouched and remains the live gateway until you deliberately switch.

---

## 1. The verification model

There is no webhook in this phase. Payment truth is established like this:

```
browser returns to /api/payments/sabpaisa/return
        ↓  verify HMAC-SHA256 return signature      ← authenticity
        ↓  load the locally stored payment session   ← what we EXPECTED
        ↓  POST /api/v2/payments/enquiry             ← what SabPaisa REPORTS
        ↓  cross-check status, reference, amount, currency, merchant identity
        ↓  paid
```

Two rules follow from this, and both are load-bearing:

- **A valid return signature is not proof of payment.** It proves the parameters
  are authentic and unmodified. It is permission to go and ask Transaction
  Enquiry, which is the only authority.
- **A network failure is never a verdict.** An unreachable enquiry leaves the
  payment `unconfirmed`, never `failed` and never `paid`. The reconciler retries.

Because there is no webhook, a shopper who pays and then closes the tab is
settled by the nightly reconciler (`/api/payments/reconcile`) or by their own
next visit to the order page. On the Hobby plan that cron runs once a day — see
the cadence warning in `api/payments/reconcile.ts`.

---

## 2. What was added

| Path | Role |
| --- | --- |
| `api/_lib/sabpaisa/env.ts` | Config, validated **independently** of Airpay. Derives the return URL. |
| `api/_lib/sabpaisa/amount.ts` | Rupees ↔ paise. The only place the two units meet. |
| `api/_lib/sabpaisa/crypto.ts` | Create Payment checksum; return-signature verification; `merchantTxnId`. |
| `api/_lib/sabpaisa/client.ts` | HTTP. Retries idempotent reads only; never retries create. |
| `api/_lib/sabpaisa/createPayment.ts` | `POST /api/v2/payments`, and the checkout redirect URL. |
| `api/_lib/sabpaisa/enquiry.ts` | `POST /api/v2/payments/enquiry`. The payment authority. |
| `api/_lib/sabpaisa/settle.ts` | The single place a SabPaisa payment may be marked paid. |
| `api/payments/sabpaisa/create.ts` | Prices the basket, persists the session, redirects to checkout. |
| `api/payments/sabpaisa/return.ts` | The fail-closed return handler. |
| `supabase/migrations/0005_sabpaisa_payments.sql` | `sabpaisa_payments` table; widens one CHECK on `orders`. |

Airpay's own modules — `airpay.ts`, `settle.ts`, `callbackFlow.ts`,
`env.ts`, and every `api/payments/*` and `api/callback/*` route — import nothing
from `sabpaisa/`.

---

## 3. Units, which SabPaisa is not consistent about

```
Create Payment       amount                 PAISE   (integer)
Transaction Enquiry  amountPaise            PAISE   (integer)
Return URL           amount, paid_amount    RUPEES  (decimal string)
```

₹1.00 is therefore `100`, `100` and `"1.00"`. Every comparison in the
settlement path happens in paise, as an integer. `api/_lib/sabpaisa/amount.test.ts`
pins this down, including the ₹1.00 worked example.

Also note: the **Create Payment** timestamp is Unix **seconds**, while the
**return URL** timestamp is epoch **milliseconds**.

---

## 4. Environment

Set these in Vercel → Project Settings → Environment Variables:

```
SABPAISA_CLIENT_CODE     Transaction Enquiry's `clientCode`
SABPAISA_MERCHANT_ID     Create Payment's `merchantId`
SABPAISA_API_KEY         sent as X-Api-Key
SABPAISA_SECRET_KEY      HMAC key for checksum + return signature
SABPAISA_BASE_URL        https://merchant-api.sabpaisa.in
PUBLIC_SITE_ORIGIN       https://www.yarnvia.online   (already set)
VITE_PAYMENT_GATEWAY     airpay | sabpaisa            (default airpay)
```

The unprefixed `CLIENT_CODE` / `MERCHANT_ID` / `API_KEY` / `SECRET_KEY` are
accepted as a fallback, which is how the current `.env` is provisioned. Prefixed
names win when both are present, and are preferred — bare `API_KEY` and
`SECRET_KEY` will collide with the next provider you add.

**`clientCode` and `merchantId` are kept strictly separate in code.** This
merchant's SabPaisa account has the same value assigned to both. That is a
property of one account, not of the protocol, and it would break silently if
SabPaisa reissued either one.

`SABPAISA_BASE_URL` must be an `https://*.sabpaisa.in` host — it receives the
API key on every request. Define it **once**: a duplicated key in `.env`
resolves to whichever line comes last, which is silent and easy to get wrong.

---

## 5. Deploying

1. **Run the migration.** Supabase Dashboard → SQL Editor → paste
   `supabase/migrations/0005_sabpaisa_payments.sql` → Run. Idempotent; safe to
   re-run. It creates `sabpaisa_payments` and widens `orders.payment_method` to
   admit `'sabpaisa'`. No existing Airpay row changes meaning.
2. **Set the environment variables** above. Leave `VITE_PAYMENT_GATEWAY` at
   `airpay` for now.
3. **Register the return URL** in the SabPaisa dashboard:
   `https://www.yarnvia.online/api/payments/sabpaisa/return`
4. **Deploy.** With the flag still `airpay`, nothing about checkout changes — the
   SabPaisa endpoints exist but no shopper reaches them.
5. **Switch over** by setting `VITE_PAYMENT_GATEWAY=sabpaisa` and redeploying,
   only once the blockers in §7 are cleared. Rolling back is the same switch in
   reverse.

---

## 6. Payment states

`sabpaisa_payments.status`:

| Status | Meaning |
| --- | --- |
| `created` | Row written; SabPaisa not yet called. |
| `redirected` | Session created; the shopper is at the hosted checkout. |
| `paid` | Enquiry said SUCCESS **and** every cross-check agreed. |
| `failed` / `expired` / `cancelled` | SabPaisa's own terminal verdict. |
| `unconfirmed` | Enquiry gave no usable answer. **Not a failure.** Retried. |
| `requires_review` | Enquiry said SUCCESS for the wrong amount, currency, reference or merchant. Money likely moved. **Nothing leaves this state automatically.** |
| `verification_failed` | A signed return was contradicted by enquiry. |

`requires_review` is the one to watch. Query it with:

```sql
select merchant_txn_id, order_ref, expected_amount_paise, last_enquiry_status, created_at
from public.sabpaisa_payments
where status in ('requires_review', 'verification_failed', 'unconfirmed')
order by created_at desc;
```

---

## 7. SABPAISA GO-LIVE READINESS

Verified in this repository:

| Item | Status |
| --- | --- |
| Production endpoint (`https://merchant-api.sabpaisa.in`) | **PASS** |
| Production credential presence (all four) | **PASS** |
| Client Code mapping (separate from Merchant ID) | **PASS** |
| Server-side checksum (HMAC-SHA256, one timestamp signed and sent) | **PASS** |
| Create Payment timestamp is Unix seconds | **PASS** |
| Server-side pricing (basket re-priced from catalogue) | **PASS** |
| Persistent payment reference (`sabpaisa_payments`, written pre-redirect) | **PASS** |
| Unique `merchantTxnId` per attempt, never reused | **PASS** |
| `clientSecret` handling (never logged, stored, or sent to the browser) | **PASS** |
| Server-side checkout redirect (303; secret only in `Location`) | **PASS** |
| Checkout URL validated as HTTPS `*.sabpaisa.in` before redirect | **PASS** |
| Return signature validation (fails closed) | **PASS** |
| Transaction Enquiry as the payment authority | **PASS** |
| Amount verification (paise, integer) | **PASS** |
| Currency verification | **PASS** |
| Duplicate-click protection (module latch + server-side) | **PASS** |
| Unknown-state handling (`unconfirmed`, never a verdict) | **PASS** |
| No blind retry of create after an uncertain timeout | **PASS** |
| 429 / `Retry-After` honoured, bounded, clamped | **PASS** |
| Secret leakage check (no secret values in `dist/`) | **PASS** |
| Airpay regression (128 Airpay tests pass; no cross-imports) | **PASS** |
| SabPaisa env validation cannot break Airpay | **PASS** |
| KKChat isolation (SabPaisa never relays) | **PASS** |
| Confirmation page does not trust query parameters | **PASS** |
| Build | **PASS** |
| Tests (402 pass, network hard-blocked) | **PASS** |
| Tests never hit production SabPaisa | **PASS** |

Requiring someone outside this repository:

| Item | Status |
| --- | --- |
| **Merchant live processing activated** | **BLOCKED — EXTERNAL CONFIRMATION REQUIRED.** SabPaisa's published checklist ends: "contact your SabPaisa account manager to activate live processing." |
| **Required payment methods activated** (UPI / card / netbanking) | **BLOCKED — EXTERNAL CONFIRMATION REQUIRED.** |
| **Production return domain accepted** | **BLOCKED — EXTERNAL CONFIRMATION REQUIRED.** The URL is correct and derived from config; SabPaisa must accept it against the live merchant. |
| **IP whitelist requirement** | **BLOCKED — EXTERNAL CONFIRMATION REQUIRED.** SabPaisa's dashboard offers Settings → Security → IP Whitelist. Vercel serverless functions have **no static outbound IP** on Hobby/Pro. If SabPaisa mandates whitelisting, this cannot be satisfied by this deployment as it stands, and needs either a SabPaisa exemption or egress through a fixed-IP proxy. **No IP address has been invented or configured here.** |
| **Webhook requirement for activation** | **BLOCKED — EXTERNAL CONFIRMATION REQUIRED.** This phase implements no webhook, by instruction. SabPaisa's published production checklist requires a registered webhook URL handling `payment.success`, `payment.failed`, `payment.expired` and `payment.timeout`, and states that relying on Transaction Enquiry alone fails that item. Confirm with the account manager whether this merchant may launch without one. |

### Not ready for live payments

Five external items above are unconfirmed. Specifically, what remains is:

1. Confirm SabPaisa has activated live processing and the payment methods.
2. Confirm whether a **webhook is mandatory** for activation. If it is, that is
   a code change requiring approval (§17 of the brief forbade it this phase).
3. Confirm whether **source-IP whitelisting** is required. If it is, Vercel's
   lack of a static outbound IP is a genuine blocker, not a configuration
   oversight.
4. Confirm the return domain is accepted for the live merchant.
5. Only then set `VITE_PAYMENT_GATEWAY=sabpaisa`, and make the **first live
   transaction a manual, small-value one** — verify `sabpaisa_payments` reaches
   `paid` with `sp_txn_id` populated, and that `orders.payment_status` is `paid`.

No automated test initiates a real transaction; all SabPaisa network calls are
mocked. The full suite passes with `fetch` hard-blocked, which is how that is
enforced rather than merely asserted.
