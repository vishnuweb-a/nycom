# Airpay Verification & Cryptography — Yarnvia

**This is the most important document in the set.** Everything that decides
whether real money is recorded as received lives here.

Written from the proven Frontiva verification implementation
(`../../clone/store/api/_lib/{crypto,airpay,orders,callback-payload}.js` plus its
`tests/`) and from a full read of Yarnvia's `api/_lib/{airpay,settle,callbackPayload}.ts`
at commit `313047a`.

Evidence tags used throughout:

| Tag | Meaning |
| --- | --- |
| **PROVEN** | Read from source, or pinned by a passing test in one of the two repos |
| **OBSERVED** | Recorded in-repo as behaviour seen from the live Airpay gateway |
| **INFERRED** | Reasoned, but confirmed by nothing |
| **UNKNOWN** | Must not be guessed |

---

## 1. Credential roles — get this wrong and nothing works

Two environment variables both look like secrets. **They are not
interchangeable, and swapping them is the single most common failure.**

| Variable | Role | Used in |
| --- | --- | --- |
| `AIRPAY_SECRET_KEY` | **OAuth2 `client_secret`** | The OAuth token request, and nowhere else |
| `AIRPAY_API_KEY` | **`privatekey` derivation secret** | `sha256(API_KEY@USERNAME:\|:PASSWORD)`, and nowhere else |

Both repositories arrived at this mapping independently, and Yarnvia arrived at
it *empirically against the live gateway*:

> Airpay rejected every OAuth request carrying `AIRPAY_API_KEY` as
> `client_secret` with `data.success: false, data.msg: "Invalid client id or
> secret"`, while the identical request carrying `AIRPAY_SECRET_KEY` returned a
> token. The same result held across url-encoded and multipart bodies and both
> URL forms, so the credential was the only variable that mattered.
>
> In the other direction, at the hosted page:
> `sha256(AIRPAY_SECRET_KEY@...)` produced **"Merchant Key Authentication
> Failed"**; `sha256(AIRPAY_API_KEY@...)` produced **"Invalid Domain"** — which
> is *progress*, not a worse error: the key was accepted and the request
> advanced to the domain check.

**OBSERVED** — `api/_lib/airpay.ts` source comments, and Frontiva has a dedicated
regression test asserting `privatekey` is derived from `API_KEY` and explicitly
**not** from `SECRET_KEY`.

> Note that the merchant originally stated the opposite mapping. The live
> gateway overrides both the documentation and the merchant's recollection. Do
> not swap them back.

---

## 2. OAuth / access token

### 2.1 Endpoint and transport

| Property | Value | Evidence |
| --- | --- | --- |
| URL | `https://kraken.airpay.co.in/airpay/pay/v4/api/oauth2/` | **PROVEN**, identical in both repos |
| Method | `POST` | **PROVEN** |
| Content-Type | `application/x-www-form-urlencoded` | **PROVEN** |
| Accept | `application/json` (Frontiva sends it; Yarnvia does not) | **PROVEN** |
| User-Agent | Frontiva sends `Frontiva/1.0 (+https://frontiva.online)`. **Yarnvia sends none.** | **PROVEN** — see 2.6 |
| Timeout | Frontiva 15 000 ms; **Yarnvia 8 000 ms** | **PROVEN** — see 2.6 |

The trailing slash on the URL is kept deliberately: Airpay's prose heads the
section `.../api/oauth2` while its runnable PHP sample sets
`CURLOPT_URL => '.../api/oauth2/'`. The runnable sample is the better evidence of
what the server actually routes, and it matches the sibling endpoints.
**PROVEN** (documented reasoning in `api/_lib/airpay.ts`).

### 2.2 Request format

The credentials travel **inside** `encdata`. They are never plain form fields.

Plaintext fields, encrypted into `encdata`:

```json
{
  "client_id":     "<AIRPAY_CLIENT_ID>",
  "client_secret": "<AIRPAY_SECRET_KEY>",
  "merchant_id":   "<AIRPAY_MID>",
  "grant_type":    "client_credentials"
}
```

Form body actually posted — **exactly three fields**:

| Field | Value |
| --- | --- |
| `merchant_id` | `AIRPAY_MID` |
| `encdata` | `IV(16 hex chars) + base64(AES-256-CBC(JSON.stringify(fields)))` |
| `checksum` | `sha256hex(<values sorted by key, concatenated> + <IST date>)` |

**`privatekey` is deliberately NOT sent on the OAuth call.** It belongs to the
token-authenticated transactional APIs. Frontiva has an explicit test asserting
the OAuth envelope has exactly the three keys above. **PROVEN.**

For this specific payload the sorted-key order is
`client_id, client_secret, grant_type, merchant_id`, so the checksum input is
`<CLIENT_ID><SECRET_KEY>client_credentials<MID><YYYY-MM-DD IST>`. **PROVEN** by
deriving it from `checksum()`'s definition.

### 2.3 Response handling — the order of checks is load-bearing

```
1. HTTP not ok?                        -> log status + Airpay's own status fields, fail
2. Parse JSON                          -> unparseable? fail
3. unwrapResponse(): is there a
   `response` field? decrypt it        -> plaintext object, or the original body
4. Search for access_token             -> absent? fail  (NOT "success")
5. Read expires_in, default 300s
6. Cache with a 60s safety margin
```

Documented success shape, once decrypted (from Airpay's OAuth2 page):

```json
{ "status_code": ..., "response_code": ..., "status": ..., "message": ...,
  "data": { "access_token": "...", "expires_in": ..., "scope": "..." } }
```

**PROVEN.**

### 2.4 The inner-failure trap — read this twice

> **A transport-level success is not an authentication success.**

A **rejected** OAuth grant still comes back as:

```json
{ "status_code": 200, "response_code": "00", "status": "success", "message": "Success",
  "data": { "success": false, "msg": "Invalid client id or secret" } }
```

The outer four fields describe whether the *request* was accepted. The verdict
lives in **`data.success`**, and the reason in **`data.msg`**. **OBSERVED** by
both projects independently; Frontiva has four dedicated tests and Yarnvia
records that reading only the outer fields "cost a full diagnostic cycle".

The two implementations handle it differently:

| | Frontiva | Yarnvia |
| --- | --- | --- |
| Mechanism | `hasInnerFailure()` — an explicit gate that **rejects** the response before the token is even looked for | No explicit gate; relies on "no `access_token` present ⇒ fail" |
| Handles `data.success: false` **with** a token-shaped field present | **Yes** — explicitly tested | **No** — would accept the token |
| Reads `data.msg` into the log | Only indirectly | **Yes**, `describeFailure()` reads `status_code`, `response_code`, `status`, `message`, `data.success`, `data.msg` |

Yarnvia's diagnostics are better; its **gate is weaker**. Neither has been
observed receiving `data.success: false` alongside a usable-looking token, so
the practical risk is currently theoretical — but adding an explicit
`hasInnerFailure`-style check to Yarnvia is a cheap, strictly-safer change.
**INFERRED** as a recommendation; the divergence itself is **PROVEN**.

### 2.5 Token expiry and caching

| | Frontiva | Yarnvia |
| --- | --- | --- |
| Nominal TTL | Read from `expires_in`, fallback 300 s | Read from `expires_in`, fallback 300 s |
| Cached? | **No** — a fresh token on every call, so one callback makes two outbound Airpay calls | **Yes** — module-scoped, reused while a Vercel instance stays warm |
| Safety margin | n/a | Refreshes 60 s early, floor of 30 s, so a token cannot expire in flight |
| Reset for tests | n/a | `resetTokenCache()` is exported |

**PROVEN.** Whether Airpay permits or penalises token reuse across calls is
**UNKNOWN** — Frontiva's docs list it as an open question, and Yarnvia's caching
has not been contradicted in production either.

### 2.6 Two Yarnvia OAuth risks inherited from a smaller timeout and no UA

1. **No `User-Agent`.** Node's `fetch` sends none by default. Frontiva's source
   states plainly that WAFs commonly reject an anonymous client with a `403`
   *before the request reaches the API*, which then looks exactly like a
   credential error. Yarnvia has not hit this — its OAuth works in production —
   so the risk is dormant, not disproven. **PROVEN** (the absence); **INFERRED**
   (the risk).

2. **8 s timeout vs Frontiva's 15 s.** This is a deliberate Yarnvia choice and
   the reasoning is sound: Vercel's default max duration is 10 s, so a 15 s abort
   could never fire first — the platform would kill the function instead,
   producing a bare 502 **and no log at all**, because the catch block never
   runs. Timing out at 8 s guarantees the error is ours, handled, and recorded.
   **PROVEN.**

---

## 3. Cryptographic primitives

All five primitives below are **identical in Frontiva and Yarnvia**, verified
line by line. Each is byte-level load-bearing; none may be "tidied".

### 3.1 AES key derivation

```
key = MD5( USERNAME + "~:~" + PASSWORD )      -> 32-character lowercase hex string
```

> **The resulting MD5 hex string is used as a 32-character ASCII key.
> It is NOT hex-decoded.**

MD5 produces 16 raw bytes — a 128-bit key, which is not a valid AES-256 key.
Airpay's PHP reference passes the output of `md5()`, and PHP's `md5()` returns
the **hex string** by default, so what reaches OpenSSL is 32 ASCII characters:
exactly the 32 bytes AES-256 requires.

```js
// Frontiva                                        // Yarnvia
md5Hex(`${username}~:~${password}`)                Buffer.from(md5Hex(`${u}~:~${p}`), 'ascii')
// used as Buffer.from(key, 'utf8')
```

For hex characters, `'ascii'` and `'utf8'` produce identical bytes, so the two
are equivalent. **PROVEN**, and Frontiva pins it with a test asserting the key is
32 characters, 32 bytes, and matches `/^[0-9a-f]{32}$/`.

**Failure mode if wrong:** `Buffer.from(md5hex, 'hex')` silently gives 16 bytes,
Node silently selects AES-128, and every request is rejected with an opaque
error. This is the single most likely reimplementation failure.

### 3.2 Initialisation vector

```
ivBytes = randomBytes(8)
iv      = ivBytes.toString("hex")             -> 16 hexadecimal characters
```

> **The resulting 16-character string is used as 16 ASCII bytes.**

Three transformations, each easy to skip: 8 random bytes → 16 hex characters →
used as 16 ASCII bytes. Using `randomBytes(16)` raw, or hex-decoding the IV back
to 8 bytes, produces unreadable ciphertext. **PROVEN** in both repos; Frontiva
pins the exact IV prefix and that the IV differs on every call.

### 3.3 Cipher

| Property | Value |
| --- | --- |
| Algorithm | **AES-256-CBC** |
| Padding | **PKCS#7** (Node's default; `setAutoPadding(true)`) |
| Key | 32 ASCII bytes from 3.1 |
| IV | 16 ASCII bytes from 3.2 |
| Output | `IV(16 chars) ‖ base64(ciphertext)` — **no delimiter** |

Frontiva pins this against an independent reference implementation in
`tests/crypto.test.js`. **PROVEN.**

Decryption is the exact inverse: take the first 16 characters as the IV, base64-
decode the remainder, decrypt, unpad.

### 3.4 Private key

```
privatekey = sha256( API_KEY + "@" + USERNAME + ":|:" + PASSWORD )   -> lowercase hex
```

**PROVEN**, identical in both repos.

Note what this is **not**: it is a per-merchant *constant*, not a per-request
signature. It does not commit to the order, the amount, or the time. In the
hosted-page flow it is POSTed from the customer's browser, so it is visible to
anyone who opens DevTools on the checkout. That is inherent to Airpay's design —
its own plugins do the same. **The consequence is that its presence in a request
authenticates nothing.** Never treat receiving it as proof of anything.
**PROVEN** (source comments in both repos).

### 3.5 Checksum

```
checksum = sha256( <values, sorted by KEY ascending, concatenated with NO separator>
                 + <IST date as YYYY-MM-DD> )
```

Rules, all load-bearing:

- **Values only.** Keys are not included.
- **No separator** between values.
- Sorted by **key** ascending (PHP `ksort`), not by value, not by insertion order.
- The date is **appended last**.
- The date is **Asia/Kolkata**, always. Airpay's reference is PHP `date('Y-m-d')`
  on an IST server. Vercel runs UTC, so between 00:00 and 05:30 IST the UTC date
  is still *yesterday* — a checksum built from `toISOString().slice(0,10)` would
  be rejected every night, for five and a half hours, and never during a
  working-hours test. Both repos use `Intl.DateTimeFormat('en-CA', {timeZone:
  'Asia/Kolkata'})` because `en-CA`'s short format is exactly ISO `YYYY-MM-DD`.
- The checksum is over the **plaintext** fields, never the ciphertext.

**PROVEN**, identical in both repos, pinned by tests on both sides including a
test that 20:00 UTC on the 13th is already the 14th in IST.

Minor divergence with no behavioural difference: Frontiva maps `null`/`undefined`
to `''`; Yarnvia uses `String(payload[key])`, which would render them as
`"null"`/`"undefined"`. Neither codebase passes such a value. **PROVEN.**

### 3.6 Request envelope structures

Two shapes, and they genuinely differ:

**Unsigned envelope** — OAuth only:

```
{ merchant_id, encdata, checksum }
```

**Signed envelope** — every token-authenticated transactional API:

```
{ merchant_id, encdata, checksum, privatekey }
```

Sending `privatekey` on the OAuth call, or omitting it on a transactional call,
is a documented failure mode. **PROVEN.**

Both are posted **form-encoded**. Sending JSON produces
`403 Forbidden: Access is denied. Parameters are required.` — the fields are
present but invisible to the server, and the error misleadingly suggests they are
missing. **OBSERVED** by Frontiva, recorded in a source comment and a test.

### 3.7 Response envelope

Airpay v4 wraps responses as:

```
{ "response": "<16 hex chars of IV><base64 ciphertext>" }
```

...for the encrypted endpoints, and returns the plaintext envelope directly for
others. **Airpay's own documentation contradicts itself**: the Decryption page
states "all the API responses are encrypted", while the Order Confirmation page
says its response is not. Both repos therefore *detect* the envelope rather than
assuming, and decrypt only when one is actually present. **PROVEN** (the code);
**UNKNOWN** (which endpoints are actually encrypted).

Envelope field names accepted:

| | Names checked |
| --- | --- |
| Frontiva API responses | `encdata`, `response`, `data` |
| Frontiva callbacks | `response`, `encdata`, `data` |
| Yarnvia (both) | `response` (API), `encdata`/`encresponse`/`response` (callback) |

**PROVEN.**

---

## 4. Order Confirmation — the verification call

> **This — not the callback and not the browser return — is the only thing
> settlement is allowed to trust.**

### 4.1 The proven Frontiva request

Frontiva's `confirmOrder(orderRef)` is the reference. **PROVEN** from source.

| Property | Value |
| --- | --- |
| URL | `${verifyUrl()}?token=${encodeURIComponent(accessToken)}` |
| Default `verifyUrl()` | `https://kraken.airpay.co.in/airpay/pay/v4/api/orderconfirmation/` |
| Override | `AIRPAY_VERIFY_URL` |
| Method | `POST` |
| Headers | form-urlencoded / `Accept: application/json` / explicit `User-Agent` |
| Timeout | 15 000 ms |
| Body | `buildSignedEnvelope({ merchant_id, orderid }, config)`, form-encoded |

**The body is exactly four form fields:**

| Form field | Value |
| --- | --- |
| `merchant_id` | `AIRPAY_MID` |
| `encdata` | `IV(16 hex) + base64(AES-256-CBC(JSON.stringify({merchant_id, orderid})))` |
| `checksum` | `sha256hex(<MID><orderRef><IST date>)` |
| `privatekey` | `sha256hex(API_KEY@USERNAME:\|:PASSWORD)` |

The encrypted plaintext is exactly two fields:

```json
{ "merchant_id": "<AIRPAY_MID>", "orderid": "<orderRef>" }
```

`merchant_id` appears **twice** — once in the clear as a form field and once
inside `encdata`. Both are sent.

Checksum worked through: keys `{merchant_id, orderid}` sorted ascending gives
`['merchant_id','orderid']`; values concatenated gives `"<MID><orderRef>"`; append
the IST date; SHA-256; lowercase hex.

**The access token goes in the query string, not an `Authorization` header.**
Same convention as the hosted payment page.

**No transaction id and no amount is sent.** Verification is keyed **solely on
the merchant's own order reference**, which is why it still works when the
callback was lost entirely — exactly what reconciliation relies on. **PROVEN.**

### 4.2 Yarnvia's request — the OPEN DEFECT

Yarnvia's `verifyTransaction()` sends something materially different:

| Property | Yarnvia | Frontiva |
| --- | --- | --- |
| URL | `.../airpay/pay/v4/api/**verify**/?token=...` | `.../airpay/pay/v4/api/**orderconfirmation**/?token=...` |
| Body | `new URLSearchParams({ orderid })` — **one plaintext field** | `{merchant_id, encdata, checksum, privatekey}` — the **signed envelope** |
| `merchant_id` | **not sent** | sent, twice |
| `encdata` | **not sent** | sent |
| `checksum` | **not sent** | sent |
| `privatekey` | **not sent** | sent |
| Timeout | 8 000 ms | 15 000 ms |
| User-Agent | none | present |
| Overridable URL | **no** | yes, `AIRPAY_VERIFY_URL` |

**PROVEN** — read directly from `api/_lib/airpay.ts`, `verifyTransaction`.

**What happens in production today.** **OBSERVED**, confirmed against MID 366950
on 2026-08-21 and recorded in `docs/AIRPAY_YARNIVA_DEPLOYMENT.md` section 18 and
pinned as a regression test in `api/_lib/airpay.test.ts`:

```
POST https://kraken.airpay.co.in/airpay/pay/v4/api/verify/?token=...
body: orderid=YV-3200A-2AB47227

HTTP 200
{ "merchant_id": null, "response": "509361e8503ab0a0I9NZa9e97O0qW189..." }
```

The `response` envelope follows the documented `encdata` layout exactly — 16
hexadecimal characters of IV, then 128 base64 characters decoding to 96 bytes, a
clean multiple of the AES block size. **It does not decrypt with
`md5(USERNAME~:~PASSWORD)`** — the key every *outbound* call uses and that Airpay
accepts on those calls. So the format is understood and only the key is wrong.

### 4.3 The leading hypothesis — and why it must be tested, not assumed

> **`merchant_id: null` in Airpay's answer is the tell.**
>
> Yarnvia never sent a `merchant_id`. Airpay echoing `null` back is consistent
> with the gateway having failed to resolve the merchant, and therefore
> encrypting the response under something other than this merchant's key — or
> returning an error payload rather than a confirmation at all.

**This is INFERRED, not proven.** It is a strong hypothesis with three
independent supports:

1. Frontiva's request — the one that is known to be built to Airpay's spec —
   sends `merchant_id`, `encdata`, `checksum` and `privatekey`. Yarnvia sends
   none of them.
2. Airpay resolves the merchant *from* `privatekey` at the hosted page, which is
   how Yarnvia's own credential-mapping investigation distinguished "Merchant Key
   Authentication Failed" from "Invalid Domain". A request with no `privatekey`
   gives the gateway no merchant to resolve.
3. Every other v4 endpoint in both codebases takes the encrypted-envelope form.
   A bare `orderid` form field is the outlier.

**Do not act on this by guessing.** The correct next step is a controlled
experiment, in this order:

1. Re-issue the same Order Confirmation call with the **full signed envelope**
   and the `orderconfirmation/` path, exactly as Frontiva builds it, and compare
   the response.
2. If the envelope still will not open, **ask Airpay integration support which
   key Order Confirmation responses are encrypted under.**

A wrong guess that happens to produce parseable output would settle orders on
fabricated data. That is worse than the current state, in which nothing settles.

### 4.4 What is NOT captured — do not invent it

> **The actual Airpay Order Confirmation response body for Yarnvia has never
> been read.** Only the *encrypted* envelope has been seen.

Specifically **UNKNOWN**:

- the decrypted field names Airpay uses on this endpoint;
- whether `data` is a nested object, a JSON string, or absent;
- whether the response echoes the order reference back;
- whether a top-level transport `status` coexists with a `transaction_status`;
- what an Order Confirmation *error* body looks like.

Both codebases handle this by searching a **candidate list** of field names
rather than committing to one shape — precisely because the shape is not known.

Yarnvia reads, from `data` (falling back to the root):

| Output | Names tried |
| --- | --- |
| `orderId` | `orderid`, `ORDERID` |
| `apTransactionId` | `ap_transactionid`, `APTRANSACTIONID` |
| `amount` | `amount`, `AMOUNT` |
| `transactionStatus` | `transaction_status`, `TRANSACTIONSTATUS` |
| `paymentStatus` | `transaction_payment_status`, `TRANSACTIONPAYMENTSTATUS` |

Frontiva additionally accepts `txnstatus`/`status` for status, `transaction_amount`/
`txnamount` for amount, and `transactionid`/`txnid` for the transaction id, via a
recursive depth-first search. **PROVEN** (both).

> **A caveat on Frontiva's list that Yarnvia does not share:** Frontiva accepts
> the bare name `status`, so a generic top-level transport `status: "success"`
> would be returned in preference to a nested `transaction_status` — and
> `classifyTransaction` treats `"SUCCESS"` as success. The exact-amount match is
> then the only remaining barrier to a wrong `paid`. Yarnvia's narrower list does
> not have this exposure. **PROVEN** (the code); **UNKNOWN** (whether such a
> field exists in a real response).

### 4.5 The "no answer" contract

`verifyTransaction` returns `null` for **every** case where the answer cannot be
obtained: unreachable, non-2xx, unparseable body, envelope that will not decrypt,
or a body carrying no transaction status at all.

> **`null` means "we do not know", never "it failed".**

This distinction is worth real money, and Yarnvia learned it the expensive way.
**OBSERVED**, recorded in source and pinned by tests:

> Before the fix, `verifyTransaction` returned a confirmation with every field
> `null`, and `settle.ts` compares `status !== AIRPAY_STATUS.SUCCESS`. Since
> `null !== 200`, "Airpay did not tell us" was recorded as "Airpay said it
> failed", and the order was terminally marked `failed`.
>
> Order `YV-3200A-2AB47227` — a genuine ₹81 UPI payment, Airpay transaction
> `2051234202`, shown as **Success** on Airpay's own dashboard — was failed that
> way. The eight `failed` orders from 2026-08-14, all with `ap_transactionid`
> null, carry the same signature and should be treated as unverified rather than
> as genuine failures.

Both directions are now guarded: `verifyTransaction` refuses to return a
statusless confirmation, and `settleOrder` refuses to act on a `null` status.
Watch for `airpay.verify.no_status` in the Vercel logs — its `envelopeDecrypted`
field separates a decryption problem from a field-naming one, which need opposite
fixes and look identical from the outside.

---

## 5. `ap_SecureHash`

**The two projects use different algorithms, and Yarnvia's is the better
founded.**

### 5.1 Yarnvia — CRC32, transcribed from Airpay documentation

```
ap_SecureHash = crc32( [ TRANSACTIONID,
                         APTRANSACTIONID,
                         AMOUNT,
                         TRANSACTIONSTATUS,
                         MESSAGE,
                         AIRPAY_MID,
                         AIRPAY_USERNAME
                         (, CUSTOMERVPA if present and non-empty) ].join(":") )
```

- CRC-32 (IEEE 802.3), matching PHP's `crc32()`, rendered as an **unsigned
  decimal string**, not hex.
- `CUSTOMERVPA` is appended **last** and **only** for UPI transactions.
- Compared against the received value after `.trim()`.

**PROVEN** — implemented in `api/_lib/airpay.ts` with its own CRC32 table, and
attributed to Airpay's documentation as recorded in `docs/payment.md` section 8.

### 5.2 Frontiva — SHA-256, self-admittedly unproven

```
ap_SecureHash = sha256( <values of every payload key except /securehash/i,
                         sorted by key, concatenated> + privatekey )
```

Frontiva's own source says the construction "is not in Airpay's public
documentation" and defaults enforcement to **off** via
`AIRPAY_ENFORCE_SECURE_HASH`. Its tests only prove the verifier is
self-consistent. **PROVEN** that it is unproven.

### 5.3 What the check is worth — in both projects

> **`ap_SecureHash` is an integrity check, not authentication.**

CRC32 is unkeyed. Every input is either public or known to anyone holding the
merchant ID and username. **Anyone able to POST to the callback can compute a
valid hash for a payload of their choosing, including a forged SUCCESS.**

A passing result means "probably not corrupted in transit" and nothing more.
Frontiva's SHA-256 variant is keyed with `privatekey`, but that value is **posted
from the browser** as part of the hosted-page form, so it is not secret either.

This is why neither project's payment safety depends on it. A forged callback
cannot mark anything paid whether or not the hash checks out, because settlement
re-verifies server-to-server. **PROVEN** (both).

### 5.4 Behaviour on mismatch

| | Frontiva | Yarnvia |
| --- | --- | --- |
| Default | **Advisory** — logged, does not block, unless `AIRPAY_ENFORCE_SECURE_HASH=true` | **Blocking** — returns `hash_mismatch` and stops |
| Empty hash | Treated as `unavailable`, does not block | Skipped entirely (`payload.secureHash !== ''` guard) |
| Risk of a wrong formula | Would strand every genuine callback in reconciliation — hence off by default | Would fail closed: order stays unsettled, logged `hash_mismatch`, **never a false success** |

Yarnvia's blocking behaviour is safe because failing closed leaves the order open
for the reconciliation sweep and the success-page poll, both of which supply no
hash at all and therefore skip the check. **PROVEN.**

**Known uncertainty, non-blocking:** the IPN payload contains `orderid` but no
`transactionid`, and Yarnvia's code passes `payload.orderRef` as
`transactionId` into the CRC32 formula. If that mapping is wrong the hash check
fails closed — never a false success. **INFERRED**; recorded as an open item in
`docs/AIRPAY_YARNIVA_DEPLOYMENT.md`.

---

## 6. Callback parsing

`parseCallbackEnvelope(req)` in `api/_lib/callbackPayload.ts`. **PROVEN.**

### 6.1 Input shapes handled

1. **Form-encoded POST** (`application/x-www-form-urlencoded`) — Vercel pre-parses
   this into `req.body`.
2. **JSON POST** — likewise pre-parsed.
3. **Raw string or Buffer body** — decoded manually. This matters: Vercel
   populates `req.body` as an object only for content types it recognises, so a
   gateway posting form fields under `text/plain`, an unusual charset suffix, or
   **no `Content-Type` at all** would otherwise flatten to nothing and be rejected
   as unparseable. That is a silent money bug, not a cosmetic one.
4. **Query string** (the GET browser-return leg) — merged with the body, **body
   wins on conflict**, being the harder one to forge into a link someone could be
   tricked into visiting.
5. **Encrypted envelope** — `encdata` / `encresponse` / `response`. The decrypted
   plaintext **replaces** the outer fields entirely rather than merging, so an
   attacker cannot pair a genuine `encdata` with unencrypted fields of their own
   choosing.

> Frontiva **merges** the decrypted fields over the outer ones instead, keeping
> the outer `merchant_id` visible for its MID check. Yarnvia's replace-don't-merge
> is the stricter choice; it also means Yarnvia has no outer `merchant_id` left to
> check. **PROVEN** (both).

### 6.2 Fields extracted

| Output | Names tried, in order |
| --- | --- |
| `orderRef` | `TRANSACTIONID`, `transactionid`, `orderid`, `order_id` |
| `apTransactionId` | `APTRANSACTIONID`, `ap_transactionid`, `aptransactionid` |
| `amount` | `AMOUNT`, `amount` |
| `transactionStatus` | `TRANSACTIONSTATUS`, `transaction_status`, `transactionstatus` |
| `message` | `MESSAGE`, `message` |
| `secureHash` | `ap_SecureHash`, `apsecurehash`, `ap_securehash`, `securehash` |
| `customerVpa` | `CUSTOMERVPA`, `customer_vpa`, `customervpa` |

Lookup is case-insensitive throughout. A missing `orderRef` returns `null` —
there is nothing to settle. **PROVEN.**

### 6.3 `TRANSACTIONID` is OURS; `APTRANSACTIONID` is Airpay's

This is confirmed against a **real production Airpay IPN** captured by Frontiva
on 2026-08-14 and pinned in `tests/callback.test.js`:

```
TRANSACTIONPAYMENTSTATUS: 'SUCCESS'      MERCID:            '366751'
TRANSACTIONID:  'FRVMFA1B2C3D4E5F6'      <- the MERCHANT's order id (ours)
APTRANSACTIONID:  '250814000123456'      <- AIRPAY's own transaction id
AMOUNT: '1500.00'                        CURRENCYCODE:      '356'
TRANSACTIONSTATUS: '200'                 MESSAGE: 'Transaction Successful'
CUSTOMVAR: 'FRVMFA1B2C3D4E5F6'           TXN_MODE: 'UPI'   CHMOD: 'upi'
CUSTOMER / CUSTOMERPHONE / CUSTOMEREMAIL / CUSTOMERVPA   <- PII
ap_SecureHash: '...'                     RRN / IPNID / RISK / TRANSACTIONTIME / ...
```

**OBSERVED** (Frontiva's capture) — this is real field-name evidence, but it is
**Frontiva's** payload, not Yarnvia's. Whether MID 366950 emits identical field
names is **UNKNOWN** until a Yarnvia callback is captured. Yarnvia's parser
accepts the same names, so the expectation is reasonable, but it is not proof.

Storing the wrong one makes reconciliation against Airpay's dashboard impossible.

### 6.4 Two protections Frontiva has that Yarnvia lacks

1. **Order-reference format gate.** Frontiva validates the extracted reference
   against `/^FRV[A-Z0-9]{5,61}$/` **before** it can reach a PostgREST filter, in
   two independent places, and treats this as a security control rather than a
   convenience. It also means Airpay's own numeric `APTRANSACTIONID` can never be
   mistaken for a merchant reference. **Yarnvia performs no format validation**;
   the raw string goes to `.eq('order_ref', orderRef)` via the Supabase client.
   The client parameterises the value, so this is not an injection hole — but
   Yarnvia's references have the equally checkable form `YV-<5>-<8 hex>` and
   gating them is free. **PROVEN** (both).

2. **Merchant-id check.** Frontiva compares the callback's `MERCID` against
   `AIRPAY_MID` in constant time and **blocks unconditionally on a mismatch** — a
   callback for another merchant is not ours to act on. **Yarnvia does not check
   the merchant id at all.** With the replace-don't-merge envelope handling, it
   would need to read `MERCID` out of the decrypted fields. The practical risk is
   low (settlement re-verifies anyway, and an unknown `order_ref` is rejected),
   but this is a genuine missing control. **PROVEN** (both).

---

## 7. Payment verification rules

### 7.1 The paid criteria — the whole rule in one place

> **An order may become `paid` only when all of the following hold:**
>
> 1. **Airpay was reachable** and returned a readable answer.
> 2. **The transaction status is classified as successful.**
> 3. **The amount exactly matches the expected server-derived amount.**

Yarnvia, from `api/_lib/settle.ts` — **PROVEN**:

```
paid  <=>  isLiveMid()
      AND  verifyTransaction(orderRef) !== null
      AND  confirmation.transactionStatus === 200
      AND  confirmation.amount !== null
      AND  |confirmation.amount - Number(order.amount)| <= 0.001
```

Frontiva, from `orders.js` `decideSettlement` — **PROVEN**:

```
paid  <=>  confirmation.verified === true
      AND  classifyTransaction(confirmation.status) === 'success'
      AND  confirmation.amountInCents !== null
      AND  confirmation.amountInCents === Math.round(Number(order.total) * 100)
```

**On integer paise.** Frontiva converts both sides to integer paise and requires
exact equality. Yarnvia compares rupee floats with a `0.001` tolerance — which is
a tenth of a paisa, so it is *effectively* exact and immune to float
representation error, and its `toPaisa()` helper already rounds the stored amount
to two decimals. The Frontiva formulation is the cleaner one to state as the
rule; Yarnvia's implementation satisfies it in practice. **PROVEN.**

### 7.2 Status classification — unknown must fail closed

> **Anything unrecognised is a failure, never a success. An unknown code must
> never become a payment.**

| Class | Frontiva (`classifyTransaction`) | Yarnvia (`AIRPAY_STATUS`) |
| --- | --- | --- |
| success | `200`, `SUCCESS` (trimmed, upper-cased) | `200` only, numeric |
| pending | `INPROCESS`, `IN_PROCESS`, `PENDING`, `210`, `211` | `211` only |
| failed | **everything else**, including `000`, `OK`, `400`, `FAILED`, `ABORTED`, `''` | everything else with a **stated** status |
| no status | `failed` (via `null` input) — but `confirmOrder` returns `verified:false` first, so this path is unreachable | **`pending`, no write** |

Frontiva's test suite explicitly pins that `'000'` and `'OK'` are **failures**.
**PROVEN.**

The full set of status codes Airpay can emit is **UNKNOWN**. Only `200`,
`SUCCESS`, `INPROCESS`, `IN_PROCESS`, `PENDING`, `210`, `211` are named anywhere,
and every other code is bucketed as failed without knowing what it means.
Yarnvia's narrower table (`200`/`211`/`400`) is a subset of the same evidence.

**Yarnvia treats a stated `210` as failed where Frontiva treats it as pending.**
If Airpay uses `210` for a genuinely in-flight transaction, Yarnvia would
terminally fail it. That is a real divergence worth resolving with Airpay before
volume. **PROVEN** (the divergence); **UNKNOWN** (what `210` means).

### 7.3 Unreachable Airpay must NOT become "failed"

> An unreachable, unreadable, or statusless verification is an **unknown**, not a
> failure. It must leave the order in a reviewable/retryable state.

| Situation | Frontiva | Yarnvia |
| --- | --- | --- |
| Airpay unreachable / timeout | `requires_review` (row written) | `pending` outcome, **no row change** — order stays `initiated` |
| Non-2xx from Airpay | `requires_review` | `pending`, no write |
| Body unparseable / envelope will not decrypt | `requires_review` | `pending`, no write |
| Credentials missing | `requires_review` | `pending`, no write |
| Status `211` (in process) | `processing` (row written) | `pending`, no write |
| Success but **no amount** in the answer | `requires_review` | `requires_review` (amount check catches `null`) |
| Success but amount **differs** | `requires_review` | `requires_review` |
| Sandbox MID | n/a — no sandbox branch exists | `unverifiable`, no write, explicit refusal |

Both satisfy the rule. They differ in *how* the reviewable state is expressed:
Frontiva writes a distinct row state; Yarnvia leaves the row untouched and relies
on the sweep filter (`payment_status IN ('initiated','pending')`) to re-check it.

**The Yarnvia choice has a real operational cost:** an order stuck at `initiated`
because Airpay could not be reached is indistinguishable, by reading the row,
from an order stuck at `initiated` because the shopper never left checkout. There
is no `ap_verified_at`, no attempt counter and no last-error field. Diagnosis
requires Vercel logs. **PROVEN.**

### 7.4 The sandbox refusal

Order Confirmation works **only against a live MID** — Airpay's documented
constraint: *"This API will work only on live MID, for the sandbox MID this API
will not work."*

Yarnvia gates on `isLiveMid()` and, on sandbox, returns `unverifiable` and leaves
the order unsettled rather than marking it paid on the strength of a callback
body. The source calls this a deliberate refusal:

> a sandbox convenience flag here would be the exact hole this module exists to
> close, and it would ship to production the first time someone mis-set
> `AIRPAY_ENV`.

**PROVEN.** Frontiva has no sandbox branch at all — its `AIRPAY_ENV` is read and
echoed but never acted on. Yarnvia's handling is strictly better.

### 7.5 Idempotency and duplicate-callback protection

Duplicate deliveries are **expected, not exceptional**: Airpay redelivers, and
the browser return races the IPN.

**Guard 1 — the cheap path.** If `payment_status` is already in
`{paid, failed, cancelled, requires_review}`, return `already_settled` immediately.
This avoids a pointless Order Confirmation round trip on the second, third and
fourth delivery. It is *not* what holds under concurrency.

**Guard 2 — the real one.** Every state change is a single conditional statement:

```sql
UPDATE orders
   SET payment_status = $1, ap_transactionid = $2, ap_verified_at = now()
 WHERE order_ref = $3
   AND payment_status NOT IN ('paid','failed','cancelled','requires_review')
RETURNING order_ref
```

The guard and the write are one statement, so two callbacks arriving
simultaneously cannot both pass. Postgres applies the row lock; whichever loses
updates **zero rows** and is told so by the returned array being empty, which the
code reports as `already_settled` — a correct outcome, not an error.

> This is why no distributed lock and no Redis is needed. The database already
> provides the only atomicity required.

**PROVEN**, and `settle.test.ts` explicitly notes that a stub ignoring the
`not.in` filter "would make these tests pass while the real thing double-settled",
so the test double honours it.

**What Yarnvia does not have:** Frontiva additionally inserts every delivery into
`payment_events` with a **unique `dedupe_key`** — `sha256(orderRef|transactionId|
transactionStatus)`, falling back to hashing the raw body — so a redelivery is a
no-op insert and there is an audit trail. Yarnvia has no such table and no
delivery-level dedupe. Settlement is still correct; **observability is not**.
**PROVEN.**

### 7.6 The four settlement triggers

All four converge on the same `settleOrder`, so no single lost message strands a
payment, and none can reach a state the others could not:

| Trigger | Route | Notes |
| --- | --- | --- |
| Server-to-server IPN | `/callback/cpm/arp/collection` (POST) | Primary |
| Browser return | `/callback/cpm/arp/collection` (navigation) | Frequently arrives **first** |
| Success-page poll | `GET /api/orders/:ref?t=` | Self-healing; 3 s interval, ~20 attempts, ~60 s |
| Reconciliation cron | `POST /api/payments/reconcile` | 5 min – 7 day window, batch 50 |

The poll and the cron both call `settleOrder` with a **synthetic payload carrying
only the reference** — every other field empty. `settleOrder` skips the integrity
check when no hash is supplied and decides purely from Order Confirmation, which
is the only authority anyway. Nothing in those synthetic payloads asserts a status
or an amount. **PROVEN.**

---

## 8. Error-handling matrix

| Failure | Detected by | Result | Order state |
| --- | --- | --- | --- |
| Client sends a tampered price | Not read at all | — | n/a |
| Item unavailable / out of stock | `priceOrder` | `409` to the browser | No order created |
| Catalogue unreachable | `priceOrder` | `503` | No order created |
| Order insert fails | `create.ts` | `503` | No order |
| OAuth unreachable | `fetchWithTimeout` abort | `502 gateway_unavailable` | `initiated` orphan |
| OAuth rejected (`data.success:false`) | no `access_token` found | `502` + `airpay.oauth.no_token` log | `initiated` orphan |
| Callback body unparseable | `parseCallbackEnvelope` returns `null` | `200 {"received":true}` | Unchanged |
| Callback for an unknown reference | `settleOrder` lookup | `unknown_order`, logged | Unchanged |
| `ap_SecureHash` mismatch | `verifySecureHash` | `hash_mismatch`, **blocks settlement** | Unchanged, sweep retries |
| Sandbox MID | `isLiveMid()` | `unverifiable` | Unchanged |
| Order Confirmation unreachable / unreadable | `verifyTransaction` returns `null` | `pending` | **Unchanged — never `failed`** |
| Order Confirmation says `211` | status check | `pending` | Unchanged |
| Order Confirmation states a non-success status | status check | `failed` | **Terminal** |
| Success but amount differs | amount check | `amount_mismatch` | **`requires_review`, terminal** |
| Concurrent duplicate settlement | conditional UPDATE returns 0 rows | `already_settled` | Unchanged |
| KKChat down / slow / 5xx / 4xx | `forwardCallback` catch | One log line | **Unaffected** |
| Anything uncaught in a handler | `withErrorHandling` | Generic public error | Unaffected |

**PROVEN** throughout.

### 8.1 Why the callback always answers 2xx

Airpay retries non-2xx responses. A retry storm against an endpoint that is
working correctly — but honestly reporting "I could not settle this yet" — helps
nobody. **The outcome is carried in the body and the logs, not the status code.**

> Frontiva takes a slightly different line: it returns `500 ERROR` in exactly one
> case — when it could not *durably record* the delivery — because that is the
> case where a redelivery genuinely helps. Yarnvia has no durable record to fail
> at, so the distinction does not arise for it. **PROVEN** (both).

### 8.2 Secret hygiene

- No `VITE_`-prefixed Airpay variable exists anywhere. Vite cannot inline what is
  not prefixed. **PROVEN.**
- `api/_lib/log.ts` redacts credential-shaped field names as a second line of
  defence; the first is simply not passing them.
- Airpay error bodies are **never logged raw** — an Airpay error can echo the
  submitted request, which would put `encdata`, and therefore the credentials
  inside it, into the log. Only four named scalar keys are read, each truncated
  to 200 characters.
- `describeShape()` logs **key names only, never values**, so a token that cannot
  be found can be located without another deploy cycle and without leaking.
- The relay logs the destination and a **field count**, never field values — a
  callback carries a customer VPA and gateway messages.
- `/api/health` reports **booleans only**: no value, no length, no prefix, and
  not even the *name* of a missing variable. Names go to the server log, which
  only the project owner can read.

**PROVEN.**

> Frontiva goes one step further with `scrubSecrets()`, which removes any
> configured credential value (4+ chars) from free-text upstream error bodies
> before logging and truncates to 300 characters, and with a `redact()` list that
> catches Airpay's **unpunctuated** PII spellings (`CUSTOMERPHONE`,
> `CUSTOMEREMAIL`, `CUSTOMERVPA`) — noting explicitly that the punctuated forms
> alone would let live customer PII through. If Yarnvia ever starts persisting
> callback payloads (Phase 1), that unpunctuated-spelling lesson must come with
> it. **PROVEN.**

---

## 9. Reimplementation checklist — the details that silently break everything

| Detail | Correct value | Failure mode if wrong |
| --- | --- | --- |
| AES key | MD5 **hex string** as 32 ASCII chars — *not* hex-decoded | Hex-decoding gives 16 bytes ⇒ AES-128 ⇒ everything rejected |
| Key separator | `~:~` | Wrong key ⇒ every request rejected |
| AES mode | AES-256-CBC, PKCS#7 | — |
| IV | `randomBytes(8)` → `.toString('hex')` → **16 chars as 16 ASCII bytes** | `randomBytes(16)` raw, or hex-decoding, gives unreadable ciphertext |
| `encdata` format | `IV(16 chars) ‖ base64(ciphertext)`, **no delimiter** | Delimiters or base64-ing the IV break parsing on both ends |
| `privatekey` | `sha256(API_KEY + "@" + USERNAME + ":\|:" + PASSWORD)` | Using `SECRET_KEY` here is the classic swap |
| OAuth `client_secret` | `AIRPAY_SECRET_KEY` | Using `API_KEY` gives `"Invalid client id or secret"` |
| Checksum | `sha256(values sorted by key, no separators, + IST date)` | Including keys, adding separators, or using UTC breaks it |
| Checksum zone | **Asia/Kolkata**, always | A UTC server is wrong for 5.5 hours every day — the worst kind of intermittent bug |
| Checksum input | **plaintext** fields, never the ciphertext | — |
| OAuth envelope | `merchant_id`, `encdata`, `checksum` — **no `privatekey`** | — |
| Transactional envelope | those three **plus `privatekey`** | Omitting it fails the transactional API |
| Token placement | **query string** `?token=...` on both the pay URL and the verify URL | An `Authorization` header will not authenticate |
| Content-Type | `application/x-www-form-urlencoded` | JSON gives `403 ... Parameters are required.` |
| User-Agent | present and non-empty | WAFs 403 anonymous clients before the API is reached |
| Verify request key | **`orderid` = the merchant's own reference** | Sending Airpay's transaction id will not resolve |
| `TRANSACTIONID` vs `APTRANSACTIONID` | `TRANSACTIONID` = **merchant's** order id; `APTRANSACTIONID` = **Airpay's** | Storing the wrong one makes dashboard reconciliation impossible |
| Success codes | `200` (and `SUCCESS` textually); `000` and `OK` are **failures** | Treating `000` as success would mark unpaid orders paid |
| Unreachable verification | `requires_review` / `pending` — **never `failed`** | A transient outage destroys a genuine payment |
| Unknown status | fail closed | An unknown code must never become a payment |
| Amount comparison | integer paise, exact | Float comparison or a loose tolerance is a rounding loophole |
| Settlement | conditional UPDATE on the open-state set | Non-idempotent settlement double-fulfils |
| Callback body | evidence and a trigger, **never proof** | A forged callback marks an order paid |
| Callback shapes | plaintext **and** `{merchant_id, response:<encrypted>}` | Assuming plaintext yields "no order reference found" |
| Audit-log failure | must not block settlement | An audit outage stops payments |
| Gateway response status | `200` on business-logic failure; `5xx` only when redelivery helps | Gratuitous 5xx triggers a retry storm |

---

## 10. Summary of Yarnvia-vs-Frontiva divergences

| # | Area | Frontiva | Yarnvia | Assessment |
| --- | --- | --- | --- | --- |
| 1 | Order Confirmation path | `/api/orderconfirmation/` | `/api/verify/` | **Open defect — see 4.2** |
| 2 | Order Confirmation body | Signed envelope (4 fields) | `orderid` only | **Open defect — leading hypothesis for the decryption blocker** |
| 3 | `ap_SecureHash` | SHA-256, unproven, advisory | CRC32, from documentation, blocking | **Yarnvia better** |
| 4 | Sandbox gating | None | Explicit `isLiveMid()` refusal | **Yarnvia better** |
| 5 | OAuth token cache | None | Module-scoped, 60 s margin | **Yarnvia better** |
| 6 | OAuth failure diagnostics | Body snippet, scrubbed | Named scalar fields incl. `data.msg` | **Yarnvia better** |
| 7 | Inner-failure gate | Explicit `hasInnerFailure()` | Implicit (no token ⇒ fail) | **Frontiva better** |
| 8 | Callback audit / dedupe table | `payment_events`, unique key | **None** | **Frontiva better** |
| 9 | Order-ref format gate | Regex, treated as a security control | **None** | **Frontiva better** |
| 10 | Merchant-id check on callback | Constant-time, blocks | **None** | **Frontiva better** |
| 11 | Outbound `User-Agent` | Present | **Absent** | **Frontiva better** |
| 12 | Upstream-error scrubbing | `scrubSecrets()` | Not logged raw at all | Equivalent |
| 13 | `requires_review` | Open, re-checked by cron | Terminal | Trade-off |
| 14 | In-process state | Distinct `processing` row state | No write; stays `initiated` | **Frontiva better for observability** |
| 15 | Status `210` | pending | failed | **Frontiva safer** |
| 16 | Order created before or after OAuth | After | Before | Trade-off |
| 17 | Relay payload | Pre-unwrap (as received) | Post-unwrap (plaintext) | **Needs a merchant decision** |
| 18 | Relay loop guard | `x-frontiva-forwarded` header | **None** | **Frontiva better** |
| 19 | Relay legs | Per delivery received | Both browser and IPN legs | **Needs a merchant decision** |
| 20 | Verify URL override | `AIRPAY_VERIFY_URL` | Hard-coded | **Frontiva better for diagnosis** |
