# Airpay Integration + KKChat Callback Relay — End-to-End Implementation Guide

**Audience:** an implementing agent integrating Airpay into an existing payment
codebase, in one pass.

**Status of the facts here:** every byte-level detail below is either transcribed
from Airpay's v4 documentation *or* established empirically against the live
gateway (MID `366950`). Where the two disagree, the empirical result wins and the
disagreement is called out. Items marked **⚠ PROVEN** cost real money to
discover — do not "tidy" them.

**Reference implementation:** `api/_lib/airpay.ts`, `api/_lib/callbackPayload.ts`,
`api/_lib/settle.ts`, `api/_lib/callbackFlow.ts`, `api/_lib/relay.ts`.

---

## 0. The one rule

> A callback is a **prompt to go and check**, never proof of payment.
>
> The only thing that may mark an order paid is Airpay's **Order Confirmation
> API** answering, server-to-server, that it was paid — for an amount the server
> computed itself.

Every design decision below follows from this. The callback body, the browser
redirect and `ap_SecureHash` are all attacker-reachable and decide nothing.

---

## 1. Architecture at a glance

```
Browser                  Your server                     Airpay              KKChat
   │                          │                            │                   │
   │─ POST /payments/create ─>│                            │                   │
   │                          │ re-price basket (DB)       │                   │
   │                          │ INSERT order (initiated)   │                   │
   │                          │─ OAuth2 token ────────────>│                   │
   │<─ {actionUrl, fields} ───│                            │                   │
   │                                                       │                   │
   │─ form POST (merchant_id, encdata, checksum, privatekey) ──> hosted page   │
   │                                          [ customer pays ]                │
   │                                                       │                   │
   │                          │<─ IPN POST ────────────────│                   │
   │<─ 303 redirect ──────────│<─ browser return ──────────│                   │
   │                          │                            │                   │
   │                          │ parse → settle → relay     │                   │
   │                          │─ Order Confirmation ──────>│  (the only truth) │
   │                          │─ POST fields (JSON) ───────────────────────────>│
   │                          │                            │                   │
   │─ GET /orders/:ref?t=… ──>│ (poll; self-heals)         │                   │
```

Three independent paths reach the same settlement, so no single one is
load-bearing:

| Path | Trigger | Covers |
|---|---|---|
| IPN / Response URL callback | Airpay posts | the normal case |
| Success-page poll | shopper on page | callback dropped/delayed |
| Cron reconciliation sweep | schedule | shopper closed the tab |

All three call **one** function, `settleOrder`. Never write a second settlement path.

---

## 2. Credentials and environment

### 2.1 Variables

| Name | Role | Required |
|---|---|---|
| `AIRPAY_MID` | Merchant ID, sent in the clear | yes |
| `AIRPAY_CLIENT_ID` | OAuth2 `client_id` | yes |
| `AIRPAY_SECRET_KEY` | **OAuth2 `client_secret`** | yes |
| `AIRPAY_API_KEY` | **the `secret` in the privatekey derivation** | yes |
| `AIRPAY_USERNAME` | key derivation + `ap_SecureHash` | yes |
| `AIRPAY_PASSWORD` | key derivation | yes |
| `AIRPAY_ENV` | `live` \| `sandbox` — explicit, never inferred | yes |
| `AIRPAY_VERIFY_URL` | override for Order Confirmation endpoint | no |
| `PUBLIC_SITE_ORIGIN` | absolute origin for the return redirect | no |
| `KKCHAT_CALLBACK_URL` | relay destination; `off` disables | no |
| `CRON_SECRET` | bearer token for the reconcile endpoint | yes |

### 2.2 ⚠ PROVEN — the two secrets are swapped relative to the docs

Merchants (and Airpay's own onboarding) state that `AIRPAY_API_KEY` is the OAuth
client secret. **It is not.** Against the live gateway:

```
client_secret = AIRPAY_API_KEY     -> data.success:false, data.msg:"Invalid client id or secret"
client_secret = AIRPAY_SECRET_KEY  -> token issued ✓

privatekey = sha256(AIRPAY_SECRET_KEY@…) -> "Merchant Key Authentication Failed"
privatekey = sha256(AIRPAY_API_KEY@…)    -> "Invalid Domain"   ← progress: key accepted
```

Each credential is used in exactly one role. Do not swap them back.

### 2.3 Never expose these

No build-tool public prefix (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`) on any Airpay
variable. All signing happens server-side; the browser receives only opaque,
already-signed fields.

---

## 3. Protocol primitives

All four derivations live in one module. Reimplementing any of them elsewhere is
how integrations drift.

### 3.1 `privatekey`

```
privatekey = sha256_hex( API_KEY + "@" + USERNAME + ":|:" + PASSWORD )
```

It is a **per-merchant constant**, not a per-request signature. It commits to
nothing — not the order, not the amount, not the time — and it is POSTed from the
customer's browser in the hosted-page flow, so it is visible in DevTools.
**Receiving it authenticates nothing.**

### 3.2 The AES key — ⚠ PROVEN, most misread detail in the protocol

```
aesKey = ASCII_BYTES( md5_hex( USERNAME + "~:~" + PASSWORD ) )   // 32 bytes
```

MD5 yields 16 raw bytes — not a valid AES-256 key. Airpay's PHP reference passes
`md5()`, which returns the **hex string** by default, so what reaches OpenSSL is
32 ASCII characters: exactly the 32 bytes AES-256 needs.

> Hex-decoding this back to 16 bytes produces a different key and a silently
> undecryptable payload. Do not "fix" it.

### 3.3 `encdata` — AES-256-CBC

```
iv      = 16 hex characters, used as 16 ASCII bytes   (NOT 8 bytes hex-decoded)
cipher  = AES-256-CBC(aesKey, iv), PKCS#5/7 padding
encdata = iv + base64(cipher(JSON.stringify(payload)))
```

The IV follows the same ASCII-of-hex convention as the key. Decryption is the
exact reverse: first 16 chars are the IV, the rest is base64 ciphertext.

Decryption must **return `null`, never throw** — a malformed callback is an
expected outcome on a public endpoint, not an exception.

### 3.4 `checksum`

```
checksum = sha256_hex( values_sorted_by_key.join("") + IST_DATE )
```

- Sort by **key** (PHP `ksort`), concatenate **values only**, **no separator**.
- The date is appended last, formatted `YYYY-MM-DD`.

### 3.5 ⚠ PROVEN — the date must be IST, not UTC

Airpay's reference is PHP `date('Y-m-d')` on an IST server. Most hosts run UTC.
Between **00:00 and 05:30 IST the UTC date is still yesterday**, so a checksum
built from `toISOString().slice(0,10)` is computed against the wrong day and
rejected — every night, for five and a half hours, and **never during a
working-hours test**.

```js
new Intl.DateTimeFormat('en-CA', {   // en-CA short format IS ISO YYYY-MM-DD
  timeZone: 'Asia/Kolkata',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now)
```

### 3.6 `ap_SecureHash` (CRC32)

```
ap_SecureHash = crc32_decimal( [
  transactionId,        // YOUR order reference, not Airpay's
  apTransactionId,
  amount,
  transactionStatus,
  message,              // verbatim — live value is "Success"; do NOT upper-case
  MERCHANT_ID,
  USERNAME,
  customerVpa,          // UPI only; appended last when present
].join(':') )
```

CRC-32 IEEE 802.3, matching PHP `crc32()`, rendered as an unsigned decimal string.

> **⚠ PROVEN by elimination.** Of seven candidate constructions, exactly one
> reproduced a real live hash. Do not normalise the case, reorder the fields, or
> drop the VPA.

> **⚠ This is an integrity check, not authentication.** CRC32 is unkeyed and
> every input is derivable by anyone holding the MID and username. A match means
> "probably not corrupted in transit" and nothing more. Anyone who can POST to
> your callback can compute a valid hash for a forged SUCCESS.

---

## 4. Request envelopes

Two shapes, differing by one field.

```js
// OAuth2 token request — privatekey MUST be absent.
// Sending it on the token request is a documented way to have it refused.
buildEnvelope(payload) = {
  merchant_id: MID,
  encdata:     encrypt(payload),
  checksum:    checksum(payload),   // over the PLAINTEXT payload
}

// Every token-authenticated transactional API (incl. Order Confirmation).
buildSignedEnvelope(payload) = { ...buildEnvelope(payload), privatekey: privateKey() }
```

Airpay resolves *which merchant is asking* from `privatekey`. Omitting it on
`/verify/` is exactly what makes the gateway answer `{"merchant_id": null, …}` —
an answer it could not attribute, encrypted under a key you do not hold.

All envelopes are sent **form-urlencoded**. A JSON body to Order Confirmation
returns `403 Forbidden: Access is denied. Parameters are required` — every field
present, none of them visible to the server.

---

## 5. Endpoints

| Purpose | URL |
|---|---|
| OAuth2 token | `https://kraken.airpay.co.in/airpay/pay/v4/api/oauth2/` |
| Order Confirmation | `https://kraken.airpay.co.in/airpay/pay/v4/api/verify/` |
| Hosted payment page | `https://payments.airpay.co.in/pay/v4/` |

Trailing slashes are load-bearing — they match Airpay's runnable PHP samples.

> **⚠ Do NOT use `…/api/orderconfirmation/`.** The gateway answers it
> `404 {"message":"no Route matched with those values"}`, verification returns
> `null`, and **every order stays unsettled forever**.

There is **no separate sandbox hostname**. The environment is selected by MID and
credentials.

---

## 6. OAuth2

```
POST /api/oauth2/
Content-Type: application/x-www-form-urlencoded
Body: buildEnvelope({ client_id, client_secret, merchant_id, grant_type: "client_credentials" })
```

The credentials travel **inside `encdata`**, not as plain form fields.

**Caching.** Tokens live 300s. Cache in module scope with a 60s safety margin so
a token cannot expire in flight. On serverless, a warm instance reuses it; a cold
start mints a new one. No shared infrastructure needed.

### 6.1 ⚠ The outer envelope is not the verdict

A **rejected** OAuth grant still returns:

```json
{ "status_code": 200, "response_code": "00", "status": "success", "message": "Success",
  "data": { "success": false, "msg": "Invalid client id or secret" } }
```

Those four outer fields describe the **transport**. The verdict is `data.success`;
the reason is `data.msg`. Reading only the envelope makes a refusal look like an
authenticated success — this cost a full diagnostic cycle.

### 6.2 Response bodies may be double-encoded

v4 sometimes returns `data` as a **JSON string** rather than an object:
`"data": "{\"access_token\":\"…\"}"`. Every `typeof x === 'object'` check skips it
silently. Search for the token by walking the structure (bounded depth ~6),
parsing nested JSON strings, and accepting aliases: `access_token`, `accessToken`,
`access-token`, `token`.

This permissiveness is safe: a wrong token simply fails the next call.

---

## 7. Creating a payment

`POST /api/payments/create`

### 7.1 Request — note what is absent

```json
{
  "items":   [{ "productId": "<uuid>", "size": "M", "quantity": 2 }],
  "address": { "firstName": "", "lastName": "", "phone": "", "email": "",
               "address": "", "landmark": "", "city": "", "state": "", "pincode": "" }
}
```

**No price, no subtotal, no shipping fee, no total.** There is deliberately
nowhere for the client to state what it thinks the order costs, so there is
nothing to accidentally trust later.

### 7.2 Server sequence — order is load-bearing

1. **Validate** the schema. Keep validation detail server-side.
2. **Re-price** the basket from the database. *This is the security boundary.*
3. **INSERT** the order as `payment_status = 'initiated'` with the server's amount.
4. **Then** mint the OAuth token — so a gateway outage leaves a recorded
   `initiated` order rather than a silent nothing.
5. Build, encrypt and sign the payload.

### 7.3 Airpay payload

```js
{
  orderid:         orderRef,            // "YV-MB3K2-7F3A9C21"
  amount:          "1499.00",           // fixed two decimals
  currency_code:   "356",               // ISO 4217 numeric, INR
  iso_currency:    "inr",
  buyer_email, buyer_phone, buyer_firstname, buyer_lastname,
}
```

Airpay receives the reference, the amount and contact details — **and nothing
else**. No SKUs, no line items, no sizes, no shipping address.

### 7.4 Response

```json
{
  "orderRef": "YV-MB3K2-7F3A9C21",
  "accessToken": "<uuid>",
  "amount": 1499,
  "actionUrl": "https://payments.airpay.co.in/pay/v4/?token=<oauth token>",
  "fields": { "merchant_id": "…", "encdata": "…", "checksum": "…", "privatekey": "…" }
}
```

### 7.5 Order reference format

```
YV-<base36 ms, last 5, upper>-<8 hex chars from CSPRNG>
```

Must **not** use `Math.random()`. This reference identifies real money and
appears in callbacks; it must not be guessable.

### 7.6 Browser hand-off

Build a hidden form, POST it to `actionUrl`, forward the fields **verbatim**
without inspecting or reordering them. The browser performs no cryptography and
holds no credential.

---

## 8. Callback processing

### 8.1 ⚠ Airpay calls the URL registered in its dashboard, not one you send

The Response URL and IPN URL are resolved **per MID from the dashboard**, not
from anything sent at transaction time. For MID 366950 both are:

```
https://www.yarnvia.online/callback/cpm/arp/collection
```

The code originally assumed `/api/payments/callback`, so **nothing Airpay sent
ever reached a handler**. `/callback/…` fell through the SPA catch-all rewrite and
was served statically: GET returned `index.html`, POST got `405`. A real ₹81 UPI
payment was stranded by exactly that.

**The dashboard is not yours to change — the application moves to meet it.** Add a
rewrite *above* the SPA catch-all:

```json
"rewrites": [
  { "source": "/callback/cpm/arp/collection",  "destination": "/api/callback/cpm/arp/collection" },
  { "source": "/callback/cpm/arp/collection/", "destination": "/api/callback/cpm/arp/collection" },
  { "source": "/((?!api/).*)", "destination": "/index.html" }
]
```

Keep the `/api/payments/callback` and `/api/payments/return` routes working too —
they are transport adapters over the *same* pipeline, so they cannot drift, and
they are the right destination if the MID is ever repointed.

### 8.2 One URL, two kinds of caller

Airpay points **both** the browser and its IPN daemon at the same URL. Settle both
identically and unconditionally; only the **reply shape** differs:

- a browser gets `303` to the order-success page;
- a machine gets `200 {"received": true, outcome}`.

Detect with `Sec-Fetch-Dest` (`document`/`iframe`/`frame`) — every current browser
sends it on a top-level navigation and no server-to-server client sends it at all.
Fall back to `Accept: text/html`.

Spoofing the header changes which *response* you get and nothing whatsoever about
whether an order is paid: both legs have already been through `settleOrder`.

### 8.3 ⚠ Always answer 2xx to a machine

Airpay retries non-2xx. An endpoint working correctly but reporting "I could not
settle this yet" would trigger a retry storm. Carry the outcome in the **body and
logs**, never the status code. Even an unparseable body gets `200` — it will not
become parseable on retry.

---

## 9. Reading the callback body — the hard part

This is where real payments were lost. The body arrives in **any** of these shapes.

### 9.1 Body may not be parsed by the runtime at all

Vercel's Node runtime parses only content types it recognises:
`application/json` → object, `application/x-www-form-urlencoded` → object,
`text/plain` → string, `application/octet-stream` → Buffer, and **every other type
returns `undefined` with the request stream left unread**. A missing header
normalises to `text/plain`, so it is specifically a *present but unrecognised*
type that yields nothing.

`multipart/form-data` is the one such type a gateway plausibly posts. **Drain the
stream yourself** before parsing:

```js
if (req.body is empty) {
  read req as a stream, cap at 512 KB, req.body = concat.toString('utf8')
}
```

Never throws; never overwrites a body the platform already parsed. Without this,
the callback is logged unparseable and the payment goes unsettled — a **silent
money bug**.

### 9.2 Decode order (each step matters)

1. If it starts `{` or `[` → try JSON.
2. If content-type is multipart, or the text contains `name="…"` → decode
   multipart **before** trying `URLSearchParams`. A multipart body run through
   `URLSearchParams` does not fail — it silently yields one nonsense key, which
   looks like a successfully parsed callback carrying no order reference.
3. Otherwise → `URLSearchParams`.

Multipart decoding can be minimal: simple named text fields only, no files, no
nesting. Recover the boundary from the header, or from the body's own first line
when the header is absent.

### 9.3 The envelope

Airpay's live gateway posts the **native v4 envelope** — two fields, and neither
is an order reference:

```json
{ "merchant_id": "366950", "response": "<16 hex IV><base64 ciphertext>" }
```

Same layout as `encdata`. Observed as `application/json` on the IPN leg and
`application/x-www-form-urlencoded` on the browser leg.

Envelope field names, in precedence order: `encdata`, `encresponse`, `response`.

### 9.4 ⚠ PROVEN — the `+`/space corruption on the browser leg

The base64 half contains `+`, and `+` is how `x-www-form-urlencoded` spells a
**space**. A sender that does not percent-encode it hands you a blob with every
`+` turned into a space. Node's base64 decoder then **skips whitespace rather than
rejecting it**, quietly shortening the ciphertext, and decryption fails with
nothing to show for it.

```js
const plaintext = decrypt(sealed)
  ?? (sealed.includes(' ') ? decrypt(sealed.replace(/ /g, '+')) : null);
```

Only run the repair **after** an attempt on the bytes exactly as received has
failed. This repairs the transport; it does not guess at the cryptography.

### 9.5 ⚠ The plaintext is NOT flat

A v4 JSON plaintext nests its fields:

```json
{ "status_code": 200, "response_code": "00", "status": "success",
  "message": "Success", "data": { "TRANSACTIONID": "YV-…" } }
```

A flat top-level-scalars-only reader keeps the outer scalars, **drops `data`
because it is an object**, and never sees the order reference inside it. That is
a real production failure: `envelope: decrypted`, `merchantCheck: match`,
`parserFailure: no_order_reference` — about fields it discarded before looking.

**Walk the plaintext breadth-first** (depth ≤ 6, ≤ 512 nodes), parsing nested JSON
strings, and let a **nested** statement of a name win over a shallower one. The
outer object is the transport wrapper — its `status` and `message` describe the
delivery, while the callback's own fields are inside. Reading the wrapper's
`message` as the transaction's also feeds the wrong string to `verifySecureHash`
and strands a genuine payment.

Carry each case-insensitive name **once**, deleting the previously held key when a
deeper one wins — otherwise a wrapper's `message` and the payload's `MESSAGE` both
reach the relay, one of them stale.

### 9.6 Checks, in this exact order

```
1. merge query + body        (body wins — harder to forge into a clickable link)
2. merchant check            → mismatch: STOP, never even open the envelope
3. open envelope             → unreadable: STOP
4. order reference present?  → no: STOP
```

**⚠ Replace, do not merge.** When the envelope opens, the plaintext fields
*replace* the outer fields. Falling through to the outer fields on failure is
precisely what lets a forger pair a captured envelope with plaintext of their own.

An unreadable envelope must **end the read**, not fall back.

If `AIRPAY_MID` cannot be read (incomplete environment), report `unavailable`
rather than throwing — this module must never throw for hostile input. It cannot
become a way in: with no environment there is no verification and no database, so
settlement fails closed a step later regardless.

### 9.7 Field names — matched case-insensitively

The documentation and the live payloads disagree about casing.

| Concept | Accepted names |
|---|---|
| order reference | `TRANSACTIONID`, `transactionid`, `orderid`, `order_id` |
| Airpay txn id | `APTRANSACTIONID`, `ap_transactionid`, `aptransactionid` |
| amount | `AMOUNT`, `amount` |
| status | `TRANSACTIONSTATUS`, `transaction_status`, `transactionstatus` |
| message | `MESSAGE`, `message` |
| secure hash | `ap_SecureHash`, `apsecurehash`, `ap_securehash`, `securehash` |
| customer VPA | `CUSTOMERVPA`, `customer_vpa`, `customervpa` |
| envelope merchant | `merchant_id`, `merchantid` |

> `MERCID` is a field of the **payload**, not of the envelope. Keep it out of the
> envelope-level merchant check.

### 9.8 Diagnostics — names, never values

Log enough shape to tell the causes apart, because each needs a different fix and,
on a live gateway, **each wrong guess costs another real payment to observe**:

```
envelope:        absent | decrypted | unreadable
merchantCheck:   absent | match | mismatch | unavailable
parserFailure:   none | merchant_mismatch | envelope_unreadable | no_order_reference
contentType, bodyType, bodyLength, decodedFieldCount, decodedKeys (≤40), queryKeys (≤20)
```

Field **names** are not secrets and are the single most useful thing to see. The
**values** beside them are a customer's phone, email and VPA — never log them, and
never log `encdata`, a derived key, or an access token.

---

## 10. Settlement — the only place an order may be marked paid

Signature: `settleOrder(payload) -> { outcome, orderRef, paymentStatus }`

### 10.1 Sequence

```
1. Load order by orderRef.                   → not found : unknown_order
2. Terminal state already?                   → yes       : already_settled  [idempotency #1]
3. ap_SecureHash present and matches?        → no        : hash_mismatch
4. isLiveMid()?                              → no        : unverifiable     [see 10.3]
5. verifyTransaction(orderRef)               → null      : pending
6. status === 211 (IN_PROCESS)               → pending
7. status === null                           → pending          ⚠ see 10.4
8. status !== 200                            → transition 'failed'
9. |confirmed amount − order.amount| > 0.001 → 'requires_review' ⚠ see 10.5
10. transition 'paid'                        → lost race : already_settled  [idempotency #2]
```

Terminal states: `paid`, `failed`, `cancelled`, `requires_review`.
`requires_review` is included so a later callback cannot quietly overwrite a flag
raised for human investigation.

### 10.2 Idempotency — the database is the lock

The real guard is a **conditional UPDATE**, where the check and the write are one
statement:

```sql
UPDATE orders
   SET payment_status = $1, ap_transactionid = $2, ap_verified_at = now()
 WHERE order_ref = $3
   AND payment_status NOT IN ('paid','failed','cancelled','requires_review')
RETURNING order_ref;
```

Two simultaneous callbacks cannot both pass — Postgres applies the row lock and
the loser updates zero rows, which is reported by an empty returned array. That
is a **correct outcome, not an error**.

No distributed lock, no Redis. The terminal-state check in step 2 is only a cheap
short-circuit to avoid a pointless Order Confirmation call on the second, third
and fourth delivery.

### 10.3 ⚠ Sandbox refuses to settle, deliberately

Order Confirmation works only against a live MID. On sandbox the trusted path is
unavailable, so the order stays **unsettled** rather than being marked paid on the
strength of a callback body.

> A "sandbox convenience" flag here is the exact hole this module exists to close,
> and it ships to production the first time someone mis-sets `AIRPAY_ENV`.

### 10.4 ⚠ PROVEN — "no status" is an unknown, NOT a failure

A confirmation with every field `null` looks harmless. But settlement compares
`status !== SUCCESS`, and **`null !== 200`**, so a response that simply could not
be read was recorded as a definitive failure and the order was terminally marked
`failed`. Order `YV-3200A-2AB47227` — a genuine ₹81 UPI payment that Airpay's own
dashboard shows as successful — was failed exactly that way, and because `failed`
is terminal, **nothing in the running system could recover it**.

> Refusing to mark an order paid without proof and refusing to mark it failed
> without proof are the same discipline. Implement both.

Guard it twice: `verifyTransaction` refuses to return a statusless confirmation,
*and* `settleOrder` treats `status === null` as `pending`.

### 10.5 Amount mismatch → `requires_review`, never paid *or* failed

Compare Airpay's figure against the amount computed at checkout, to the paisa
(tolerance `0.001`). Anything looser is a rounding loophole.

Money may well have moved, just not the expected sum — so automation stops and a
human investigates. **Do not leave it `initiated`**: the reconciliation sweep would
re-verify it forever and the shopper would sit on "processing" indefinitely with
nothing surfacing the discrepancy.

### 10.6 Cancellation

`cancelOrder` moves an order to `cancelled` through the same conditional UPDATE,
so it can only ever move it out of `initiated` — it cannot undo a payment that a
callback settled while the shopper was pressing back.

---

## 11. Order Confirmation (`verifyTransaction`)

The **sole** basis on which an order may be marked paid.

```
POST {verifyUrl}?token=<oauth token>
Content-Type: application/x-www-form-urlencoded
Accept:       application/json
User-Agent:   <a real one>          ← Node fetch sends none; a WAF refusing an
                                      anonymous client looks like a credential error
Body: buildSignedEnvelope({ merchant_id: MID, orderid: orderRef })
```

`merchant_id` travels **twice** — once in the clear so the gateway can route, once
inside `encdata` where the checksum commits to it.

Verification is keyed on **your own order reference and nothing else** — no amount,
no Airpay transaction id. That is exactly what lets the reconciliation sweep verify
an order whose callback never arrived.

### 11.1 Response handling

The docs contradict themselves — the Decryption page says all responses are
encrypted, the Order Confirmation page says this one is not. **Detect the
envelope** (`{"response": "<IV><base64>"}`) and decrypt only when present. Record
which of the three happened (`absent` / `decrypted` / `unreadable`), because
"Airpay sent nothing we recognise" and "Airpay sent something we cannot decrypt"
need opposite fixes and are indistinguishable from the body alone.

Read fields from `record.data` when present, else the record itself.

### 11.2 Fail-closed cross-checks

| Check | On mismatch |
|---|---|
| `hasInnerFailure` — `success` is `false`/`"false"`/`0`/`"0"` at either level | `null` |
| stated `orderid` ≠ requested `orderRef` | `null` |
| stated `merchant_id` ≠ `AIRPAY_MID` | `null` |
| `transaction_status` absent | `null` ⚠ §10.4 |
| status is SUCCESS but `transaction_payment_status` does not match `/^success/i` | `null` |

Airpay is not known to echo `orderid`/`merchant_id` back, so each is checked
**only when actually stated**: silence is not a mismatch, and a mismatch is never
settled.

The status-conflict check is deliberately narrow — it fires only when Airpay
states a *success* and then contradicts it. An absent field is silence, and any
value beginning "success" is accepted, so a wording change cannot strand a genuine
payment.

### 11.3 Never throws; `null` means "could not obtain an answer"

Every inconclusive path returns `null`: unreachable gateway, non-2xx, unreadable
envelope, inner failure, an answer about another order, an answer with no status.
Callers treat `null` as **"not paid yet, ask again later"** — never as a failure to
report to the customer.

If the OAuth token cannot be minted, catch it and return `null`. Letting the
checkout-flavoured `PublicError` escape would turn a settlement into a 500 and
invite Airpay to retry a callback that was never the problem.

### 11.4 Status codes

| Value | Meaning |
|---|---|
| `200` | SUCCESS |
| `211` | IN_PROCESS (UPI can sit here legitimately) |
| `400` | FAILED |

---

## 12. Timeouts

| Call | Budget | Why |
|---|---|---|
| Airpay OAuth / verify | **8 s** | must be *below* the platform's 10 s function ceiling |
| KKChat relay | **5 s** | pure added latency; settlement is already done |

> At 15 s the abort could never fire first: a hung gateway got the whole function
> killed by the platform instead, producing a bare 502 and — worse — **no log at
> all**, because the catch block never ran. Time out below the ceiling so the error
> is yours, handled, and recorded.

---

## 13. The KKChat relay

### 13.1 Contract

```
POST <destination>
Content-Type: application/json
Accept:       application/json
Body:         a JSON OBJECT of the Airpay fields
```

Not form-urlencoded. Not query parameters. **Not a JSON string containing JSON** —
`JSON.stringify` is applied exactly once, so the body is
`{"MERCID":"366751","TRANSACTIONSTATUS":"200"}` rather than a quoted, escaped
string of the same thing. The receiving end parses those very differently.

Values arrive as strings and **stay strings**. Nothing is re-encrypted, renamed,
re-cased, coerced to a number, or dropped. Forward the fields exactly as received
(original casing preserved), **after** the envelope was opened.

### 13.2 ⚠ PROVEN — the path segment is the whole integration

```
Default: https://kkchat.in/callback/cpm/arp_frontiva/collection
```

The middle segment attributes a callback to a source integration. KKChat routes
**only on the trailing `/collection`** and answers `200 "success"` to *any* middle
segment:

```
GET /callback/cpm/arp/collection                     -> 200 "success"
GET /callback/cpm/arp_frontiva/collection            -> 200 "success"   ← the real one
GET /callback/cpm/DEFINITELY_NOT_A_REAL_PATH_xyz/…   -> 200 "success"
GET /callback/cpm/arp/nonsense                       -> 404
```

An unrecognised segment is **accepted and discarded**. Every relay sent to
`…/cpm/arp/collection` was answered `200 success`, logged as a forwarding success,
and **nothing reached the merchant**. No amount of log reading on the sending side
could have shown it.

> **A 200 from this host is not evidence of delivery.** Confirm the exact segment
> with the merchant before going live.

### 13.3 The relay is auxiliary — enforce it

Notifying KKChat is **not part of taking a payment**. Nothing in the relay may
influence whether an order settles.

- `forwardCallback` **never throws**, never retries, and returns nothing to branch on.
- Every failure mode — DNS, TLS, timeout, reset, 4xx, 5xx, an HTML error page —
  resolves to "log it and carry on".
- No retry: Airpay re-delivers on its own schedule if it did not get a 200 from
  you, and retrying here would multiply that.
- Read `KKCHAT_CALLBACK_URL` from `process.env` **directly**, not through the
  validated payment-credential schema, so a misconfiguration on either side
  cannot take the other down. `off`/`disabled` opts out entirely.

### 13.4 ⚠ Await it, even though it is fire-and-forget in spirit

On a serverless runtime the instance may be **frozen the moment the response is
written**, silently dropping an un-awaited request. The relay would appear to work
locally and never fire in production. Awaiting is safe: it cannot throw and is
bounded by its own 5 s timeout, so the worst case is a slightly later response.

### 13.5 Abuse bounds

The inbound endpoint is public and unauthenticated, so anyone can cause an
outbound POST. Cap at **64 fields** and **1024 chars per value** — far above any
real Airpay callback, so a legitimate payload passes untouched and only abuse is
trimmed.

### 13.6 Which legs relay

| Leg | Relay? |
|---|---|
| `/callback/cpm/arp/collection` — IPN | ✅ |
| `/callback/cpm/arp/collection` — browser | ✅ |
| `/api/payments/callback` | ✅ |
| `/api/payments/return` | ❌ |

Both legs of the public route relay deliberately: under the previous integration
KKChat's own endpoint was registered as the Response *and* IPN URL, so it already
saw both deliveries. Relaying only traffic classified as an IPN fails silently and
completely when Airpay sends the browser leg alone — the worse failure by a wide
margin.

### 13.7 Pipeline order is load-bearing

```
parse → settle → relay
```

Settlement **completes** before the relay is attempted, so a KKChat outage can
never delay, corrupt or roll back a verified payment.

---

## 14. The browser return

### 14.1 The redirect carries no claim about the payment

Target: `{origin}/order-success?ref=<orderRef>&t=<accessToken>`

It carries the order reference and the order's opaque read key — **and no claim
about whether the payment succeeded**. The success page then asks the server what
actually happened. A redirect proves only that a browser was pointed at a URL;
anyone can type one.

The read key is looked up **server-side** from the order row, never taken from the
request, so a crafted return URL cannot hand someone else's token back. Unknown
reference → `?status=unknown`.

Use **303** so a POSTed return becomes a GET, and set `Cache-Control: no-store`.

### 14.2 Origin resolution

`PUBLIC_SITE_ORIGIN` is authoritative. `x-forwarded-host` is used only to build a
redirect back to this same deployment — **never as a trust signal**. Build the URL
by concatenation, not `new URL`, which throws on the bare relative path an
unresolvable origin leaves behind.

---

## 15. Authoritative status endpoint

`GET /api/orders/:ref?t=<access_token>`

- Auth by the opaque per-order UUID, compared in **constant time**
  (`timingSafeEqual`, length-checked first). The order reference alone is not
  enough: references appear in the Airpay dashboard and in URLs, and the row holds
  a shipping address.
- **One indistinguishable 404** for "no such order" and "wrong token", so the
  endpoint cannot be used to discover which references exist.
- **Self-healing:** if the order is unsettled, run `settleOrder` inline. The
  shopper sitting on the page drives verification themselves when the webhook
  never arrived. Same trusted path, different trigger.
- Response is deliberately thin: `orderRef, paymentStatus, status, paymentMethod,
  amount, currency, createdAt, settled`. No address, no gateway detail, no
  internal ids.

`settled` includes `requires_review` — the shopper should stop seeing a spinner
even though the order is not finished; it waits on a human and no amount of
polling will change it.

### 15.1 Client polling

Every 3 s, max 20 attempts (~60 s). Start in `checking`, never in a success state.
On budget exhaustion report **`unresolved`**, not `failed` — a transient fetch
failure is not an answer, and inventing an outcome is exactly the bug this design
avoids.

Terminal client states: `paid`, `failed`, `requires-review`, `unresolved`, `not-found`.

---

## 16. Reconciliation sweep

`GET|POST /api/payments/reconcile`, on a cron schedule.

Airpay's Order Confirmation is a **pull** interface keyed by `orderid` — a value
you generate and own — so settlement never actually depends on being told. This
sweep covers the case where nobody is on the success page because they paid and
closed the tab.

| Bound | Value | Why |
|---|---|---|
| `MIN_AGE_MS` | 5 min | give the normal paths a chance first |
| `MAX_AGE_MS` | 7 days | **must comfortably exceed the cron interval** |
| `BATCH_SIZE` | 50 | one Order Confirmation round trip each; bounds runtime |

> ⚠ `MAX_AGE_MS` sized at exactly one interval is a hole: at a daily cadence, an
> order created shortly after one run passes 24 h before the next, drops out of
> the window, and is **never settled at all** — the precise failure this endpoint
> exists to prevent. Seven days gives six spare runs.

Query: `payment_method = 'airpay'` AND `payment_status IN ('initiated','pending')`
AND within the age window, oldest first.

Pass a **synthetic payload** carrying only the reference — every other field empty.
`settleOrder` skips the integrity check when no hash is supplied and decides purely
from Order Confirmation, which is the only authority anyway. Nothing asserts a
status or an amount.

**Authorization is required, not optional** — this endpoint triggers outbound calls
against the live MID. `Authorization: Bearer $CRON_SECRET`, compared with
`timingSafeEqual`, answering **404** (not 401) on mismatch.

> ⚠ Cadence is plan-limited. Vercel Hobby permits cron once per day. A shopper who
> pays and closes the tab may wait up to a day. Shoppers who return to the success
> page are unaffected. On Pro, a 15-minute schedule closes the gap.

---

## 17. Database schema

```sql
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_ref         text not null unique,          -- 'YV-…' sent as Airpay orderid
  access_token      uuid not null default gen_random_uuid(),
  status            text not null default 'pending',
  payment_method    text not null check (payment_method in ('cod','airpay')),
  payment_status    text not null default 'pending'
                    check (payment_status in ('pending','initiated','paid',
                                              'failed','cancelled','requires_review')),
  amount            numeric(10,2) not null check (amount >= 0),  -- THE authority
  currency          text not null default 'INR',
  address           jsonb not null,
  items             jsonb not null,
  ap_transactionid  text,
  ap_verified_at    timestamptz,
  inventory_applied boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_ap_transactionid_idx
  on public.orders (ap_transactionid) where ap_transactionid is not null;
create index if not exists orders_unsettled_idx
  on public.orders (created_at desc) where payment_status in ('initiated','pending');

-- RLS enabled with DELIBERATELY NO POLICIES: no matching policy denies everything,
-- so a browser anon key can neither read nor write an order. Only the service
-- role — held exclusively by the server functions — reaches this table.
alter table public.orders enable row level security;
```

**Do not mirror Airpay's transaction data.** Payment mode, card BIN, bank, RRN and
settlement batch stay in Airpay, one dashboard lookup away keyed by `order_ref`.
Duplicating them creates two sources of truth about money and no way to reconcile
them.

---

## 18. Edge-case register

| # | Edge case | Symptom | Handling |
|---|---|---|---|
| 1 | Checksum built from UTC date | rejected 00:00–05:30 IST only, never in a working-hours test | IST via `Intl` `en-CA` (§3.5) |
| 2 | AES key hex-decoded to 16 bytes | silently undecryptable | use the 32 ASCII chars (§3.2) |
| 3 | `privatekey` sent on OAuth request | token refused | omit it (§4) |
| 4 | `privatekey` omitted on `/verify/` | `{"merchant_id": null, …}`, unreadable | `buildSignedEnvelope` (§4) |
| 5 | JSON body to Order Confirmation | `403 … Parameters are required` | form-urlencoded (§5) |
| 6 | Wrong verify path `/orderconfirmation/` | 404 no route; every order unsettled | use `/verify/` (§5) |
| 7 | OAuth secret / API key swapped | `Invalid client id or secret` | §2.2 |
| 8 | Reading only the outer envelope | refusal looks like success | read `data.success`/`data.msg` (§6.1) |
| 9 | `data` arrives as a JSON string | token "missing" on a successful grant | walk + parse nested strings (§6.2) |
| 10 | Callback hits an unregistered URL | 405 / `index.html`; payment stranded | rewrite the dashboard URL (§8.1) |
| 11 | `multipart/form-data` callback | `req.body === undefined`, unparseable | drain the stream (§9.1) |
| 12 | Multipart through `URLSearchParams` | one nonsense key, looks parsed | multipart first (§9.2) |
| 13 | `+` → space in the browser-leg envelope | decryption fails silently | repair after first attempt fails (§9.4) |
| 14 | Nested `data` in plaintext | `no_order_reference` on fields never read | breadth-first walk (§9.5) |
| 15 | Wrapper `message` shadows payload `MESSAGE` | `ap_SecureHash` mismatch, payment stranded | deeper wins; carry each name once (§9.5) |
| 16 | Envelope fails → fall back to outer fields | forged plaintext + captured envelope | replace, don't merge; stop on unreadable (§9.6) |
| 17 | Callback for another merchant | acting on a foreign payment | merchant check before decryption (§9.6) |
| 18 | Field casing differs from docs | fields not found | case-insensitive lookup (§9.7) |
| 19 | Non-2xx to Airpay | retry storm | always 2xx to machines (§8.3) |
| 20 | Duplicate / concurrent callbacks | double settlement | conditional UPDATE (§10.2) |
| 21 | Browser return races the IPN | double settlement | same, plus terminal short-circuit (§10.2) |
| 22 | Sandbox MID | Order Confirmation unavailable | refuse to settle; `unverifiable` (§10.3) |
| 23 | **Confirmation with no status** | genuine payment terminally marked `failed` | `null` ⇒ pending, guarded twice (§10.4) |
| 24 | Amount differs from priced total | wrong sum may have been charged | `requires_review`, human stops automation (§10.5) |
| 25 | Verification unreachable / non-2xx | inconclusive | `pending`, retry later (§11.3) |
| 26 | Confirmation names another order/MID | not evidence about this payment | fail closed (§11.2) |
| 27 | UPI sits `211 INPROCESS` | shopper waiting | `pending`; honest "processing" (§10.1) |
| 28 | OAuth token unavailable during settlement | 500 + Airpay retries | catch, return `null` (§11.3) |
| 29 | Gateway hangs past function ceiling | bare 502, **no logs** | 8 s abort under the 10 s cap (§12) |
| 30 | Relay body double-stringified | receiver parses a string, not an object | `JSON.stringify` once (§13.1) |
| 31 | Wrong KKChat path segment | `200 success`, nothing delivered | confirm the segment (§13.2) |
| 32 | KKChat down / slow / 5xx | — | log and carry on; never affects settlement (§13.3) |
| 33 | Relay not awaited on serverless | works locally, never fires in prod | await it (§13.4) |
| 34 | Public endpoint used to push bulk data | outbound abuse | 64 fields / 1024 chars (§13.5) |
| 35 | Believing the redirect | "paid" for an unpaid order | redirect carries no claim; poll (§14.1) |
| 36 | Crafted return URL | leaking another order's token | look the key up server-side (§14.1) |
| 37 | Order ref from `Math.random()` | guessable money identifier | CSPRNG (§7.5) |
| 38 | Status endpoint reveals existence | reference enumeration | identical 404s (§15) |
| 39 | Polling budget exhausted | inventing "failed" | report `unresolved` (§15.1) |
| 40 | Reconcile window == cron interval | orders fall through the gap forever | 7-day window (§16) |
| 41 | Reconcile endpoint unauthenticated | anyone drives the live MID | required bearer, 404 on mismatch (§16) |
| 42 | Client sends its own total | underpayment | never read a client price (§7.1) |
| 43 | `AIRPAY_VERIFY_URL` defined-but-empty | fails URL validation, **all payments down** | normalise `''` → `undefined` (§2) |
| 44 | Env unreadable inside the parser | throw on hostile input | report `unavailable`, fail closed later (§9.6) |
| 45 | `requires_review` overwritten by a later callback | human's flag lost | include it in TERMINAL (§10.1) |
| 46 | Shopper abandons the gateway | order stuck `initiated` | `cancelOrder`, non-terminal only (§10.6) |

---

## 19. Implementation checklist

**Config**
- [ ] All 11 environment variables set; no public build prefix on any of them
- [ ] `AIRPAY_SECRET_KEY` = OAuth secret, `AIRPAY_API_KEY` = privatekey secret (§2.2)
- [ ] `AIRPAY_ENV` set explicitly; `AIRPAY_VERIFY_URL` unset (not blank)
- [ ] Callback URL registered in the Airpay dashboard **matches a real route**
- [ ] KKChat path segment confirmed with the merchant (§13.2)

**Primitives** (one module, no duplicates)
- [ ] `privateKey`, `aesKey` (32 ASCII hex chars), `encrypt`/`decrypt`, `checksum`
- [ ] `istDate` via `Intl` — not `toISOString`
- [ ] `crc32` + `verifySecureHash` with the proven field order
- [ ] `buildEnvelope` (no privatekey) and `buildSignedEnvelope` (with)

**Create**
- [ ] Schema accepts no money field of any kind
- [ ] Re-price from DB → INSERT `initiated` → *then* mint token
- [ ] Amount as `toFixed(2)`; order ref from a CSPRNG

**Callback**
- [ ] Rewrite added **above** the SPA catch-all
- [ ] Body hydration drains the stream (512 KB cap)
- [ ] JSON → multipart → urlencoded, in that order
- [ ] Envelope: `encdata`/`encresponse`/`response`; `+`-repair fallback
- [ ] Breadth-first plaintext walk; deeper name wins; each name carried once
- [ ] Merchant check **before** decryption; replace-don't-merge; stop on unreadable
- [ ] Case-insensitive field lookup across all documented aliases
- [ ] Always 2xx to machines; 303 to browsers via `Sec-Fetch-Dest`
- [ ] Diagnostics log names and categories only — never values

**Settle**
- [ ] Exactly one `settleOrder`; all routes call it
- [ ] Conditional UPDATE with `NOT IN (terminal)` as the idempotency guard
- [ ] `status === null` ⇒ `pending`, guarded in both verify and settle
- [ ] Amount compared to 0.001 ⇒ `requires_review`
- [ ] Sandbox refuses to settle

**Verify**
- [ ] `/verify/` + form-urlencoded + signed envelope + real `User-Agent`
- [ ] Envelope auto-detected; state recorded
- [ ] All five fail-closed checks; never throws; 8 s timeout

**Relay**
- [ ] JSON object body, stringified once, values untouched
- [ ] Awaited; cannot throw; 5 s timeout; 64/1024 bounds
- [ ] Runs *after* settlement; `off` disables

**Recovery**
- [ ] Status endpoint: constant-time token, identical 404s, self-healing settle
- [ ] Client polls 3 s × 20, reports `unresolved` on exhaustion
- [ ] Cron sweep authorized, 5 min / 7 day window, batch 50

**Data**
- [ ] `orders` table with the check constraint including `requires_review`
- [ ] RLS enabled with **no policies**; service role only
- [ ] No mirroring of Airpay transaction data

---

## 20. Log event reference

| Event | Meaning |
|---|---|
| `payment.initiated` | order recorded, before the gateway is contacted |
| `airpay.oauth.issued` / `.no_token` / `.http_error` / `.unreachable` | token lifecycle |
| `payment.callback.received` | a callback parsed successfully |
| `payment.callback.unparseable` | + `envelope`/`merchantCheck`/`parserFailure` — **start here** |
| `payment.callback.duplicate` | idempotent re-delivery |
| `payment.callback.hash_mismatch` | integrity check failed |
| `payment.callback.unknown_order` | stale retry or a probe |
| `airpay.verify.no_status` / `.unparseable` / `.inner_failure` / `.order_mismatch` / `.merchant_mismatch` / `.status_conflict` | inconclusive verification |
| `payment.verify.skipped_sandbox` | non-live MID; left unsettled |
| `payment.verify.amount_mismatch` | → `requires_review` |
| `payment.settled.paid` / `.failed` / `.cancelled` / `.race_lost` | terminal transitions |
| `payment.callback.forward.start` / `.success` / `.rejected` / `.failed` | relay — **`.success` is not proof of delivery** (§13.2) |
| `payment.reconcile.swept` | sweep counts by outcome |

Never logged, anywhere: credentials, derived keys, `encdata`/`response` blobs,
access tokens, and any callback field **value**.
