-- ============================================================================
-- Yarnvia — SabPaisa payment sessions (PG 3.0)
-- Run once in the Supabase SQL Editor. Safe to re-run: every statement is
-- idempotent.
-- ============================================================================
--
-- Why a separate table rather than more columns on `orders`.
--
-- `orders.ap_transactionid` and `orders.ap_verified_at` are Airpay's, and their
-- semantics are load-bearing for a live flow that is currently taking money:
-- `settle.ts` treats a non-null `ap_verified_at` as "Order Confirmation has
-- spoken". Reusing either column for SabPaisa would overload that meaning and
-- put the Airpay integration's correctness at the mercy of a second provider.
--
-- So SabPaisa gets its own table, and the only change to `orders` is widening
-- one CHECK constraint to admit a new payment_method value. An order still
-- holds the authoritative amount and the fulfilment state; this table holds the
-- provider-specific payment session that points at it.
--
-- This table is the authority on what Yarnvia EXPECTED to be paid. The SabPaisa
-- Transaction Enquiry response is the authority on what SabPaisa ACTUALLY
-- reports. A payment is marked paid only when the two agree — see
-- `api/_lib/sabpaisa/settle.ts`.

-- ─── orders.payment_method gains 'sabpaisa' ─────────────────────────────────
-- Additive only. The existing 'cod' and 'airpay' values keep working exactly as
-- before, so no Airpay row changes meaning and no Airpay code path is touched.

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('cod', 'airpay', 'sabpaisa'));

-- ─── The SabPaisa payment session ───────────────────────────────────────────

create table if not exists public.sabpaisa_payments (
  id                    uuid primary key default gen_random_uuid(),

  -- Our reference, sent to SabPaisa as `merchantTxnId` and echoed back on the
  -- return URL as `merchant_txn_id`. Unique because every legitimate new
  -- payment attempt must mint a fresh one: reusing it across attempts would
  -- make Transaction Enquiry ambiguous about which attempt it is answering.
  merchant_txn_id       text not null unique,

  -- The order this session is paying for. An order may accumulate more than one
  -- session (first attempt expired, shopper retried), so this is deliberately
  -- NOT unique.
  order_ref             text not null references public.orders (order_ref)
                        on delete cascade,

  -- SabPaisa's own identifiers, both learned only after the fact:
  --   payment_id     — returned by Create Payment
  --   sp_txn_id      — returned on the return URL / by enquiry, persisted only
  --                    AFTER verification succeeds
  payment_id            text,
  sp_txn_id             text,

  -- THE expected figure, in paise, integer. Paise and not rupees because that
  -- is the unit both Create Payment and Transaction Enquiry speak, and an
  -- integer because comparing money as a float is how off-by-one-paisa bugs
  -- get written. The return URL speaks RUPEES; conversion is explicit and
  -- tested in `sabpaisa/amount.test.ts`.
  expected_amount_paise bigint not null check (expected_amount_paise > 0),
  currency              text not null default 'INR',

  -- created | redirected | paid | failed | expired | cancelled
  --         | requires_review | verification_failed | unconfirmed
  --
  -- The three non-obvious states, all of which exist so the system can refuse
  -- to lie about money:
  --
  --   unconfirmed          Enquiry was unreachable. Money may or may not have
  --                        moved. NEVER rendered as success or failure; the
  --                        reconciler retries it.
  --   verification_failed  A signed return arrived but Enquiry contradicted it,
  --                        or a critical field mismatched.
  --   requires_review      Enquiry says SUCCESS for an amount, currency or
  --                        reference that is not what we expected. Money likely
  --                        moved, but not the sum we asked for. Automation
  --                        stops; a human decides. Nothing leaves this state
  --                        automatically.
  status                text not null default 'created'
                        check (status in ('created', 'redirected', 'paid',
                                          'failed', 'expired', 'cancelled',
                                          'requires_review',
                                          'verification_failed', 'unconfirmed')),

  -- Non-secret diagnostics. `clientSecret` is deliberately absent from this
  -- table and from every log: it is bearer material for the hosted checkout and
  -- is never persisted, logged or returned to the browser.
  payment_mode          text,
  last_enquiry_status   text,
  verified_at           timestamptz,

  -- SabPaisa expires a checkout session; past this the session is dead and a
  -- retry must mint a new merchant_txn_id.
  expires_at            timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists sabpaisa_payments_order_ref_idx
  on public.sabpaisa_payments (order_ref);

create index if not exists sabpaisa_payments_sp_txn_id_idx
  on public.sabpaisa_payments (sp_txn_id)
  where sp_txn_id is not null;

-- Serves the reconciler: the sessions whose fate is still genuinely open.
create index if not exists sabpaisa_payments_unsettled_idx
  on public.sabpaisa_payments (created_at desc)
  where status in ('created', 'redirected', 'unconfirmed');

drop trigger if exists sabpaisa_payments_set_updated_at on public.sabpaisa_payments;
create trigger sabpaisa_payments_set_updated_at
  before update on public.sabpaisa_payments
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Enabled with NO POLICIES, exactly as `orders`. Under Postgres RLS a table
-- with no matching policy denies everything, so the anon key in the browser
-- bundle can neither read nor write a payment session. Only
-- SUPABASE_SERVICE_ROLE — held solely by the functions in api/ — reaches it.

alter table public.sabpaisa_payments enable row level security;
