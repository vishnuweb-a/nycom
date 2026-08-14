-- ============================================================================
-- Yarnvia — orders (Airpay payment integration)
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================
--
-- Scope note. This table is the merchant's system of record for an order, and
-- deliberately nothing more. It holds what only Yarnvia can know — line items,
-- sizes, the shipping address, the authoritative amount, fulfilment state — and
-- three columns linking to Airpay.
--
-- It does NOT mirror Airpay's transaction data. Payment mode, card BIN, bank,
-- RRN, settlement batch and the raw gateway response stay in Airpay, one
-- dashboard lookup away keyed by `order_ref`. Duplicating them would create two
-- sources of truth about money and no way to reconcile them.
--
-- Cash on Delivery orders are unaffected by this migration and continue to live
-- in the shopper's browser, exactly as before.

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),

  -- The merchant reference sent to Airpay as `orderid`. Format 'YV-…'.
  -- Generated server-side with crypto-grade entropy: once this identifies real
  -- money it is a security value, not a display string.
  order_ref         text not null unique,

  -- Opaque read key. Lets the success page fetch its own order's status without
  -- authentication, while making order references unguessable in bulk. Anyone
  -- with the ref alone cannot read the address or amount.
  access_token      uuid not null default gen_random_uuid(),

  -- Fulfilment lifecycle, mirroring ORDER_STATUS_SEQUENCE in src/types/order.ts.
  status            text not null default 'pending',

  payment_method    text not null check (payment_method in ('cod', 'airpay')),

  -- pending | initiated | paid | failed | cancelled | requires_review
  --
  -- `requires_review` is reached when Airpay confirms a successful payment for
  -- an amount that does not match `amount` below. It is deliberately neither
  -- paid nor failed: money may well have moved, just not the expected sum, so
  -- automation must stop and a human must look. Nothing transitions out of it
  -- automatically.
  payment_status    text not null default 'pending'
                    check (payment_status in ('pending', 'initiated', 'paid',
                                              'failed', 'cancelled', 'requires_review')),

  -- THE authority. Computed server-side from the catalogue and compared against
  -- what Airpay reports before any order is marked paid. Never client-supplied.
  amount            numeric(10, 2) not null check (amount >= 0),
  currency          text not null default 'INR',

  address           jsonb not null,
  items             jsonb not null,          -- snapshot; mirrors OrderItem[]

  -- The Airpay link. Three columns, not a mirrored transactions table.
  ap_transactionid  text,
  ap_verified_at    timestamptz,

  -- Idempotency guard for the future inventory decrement (docs/payment.md §16).
  inventory_applied boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- `order_ref` is already unique (and therefore indexed); these serve the
-- lookups the callback and the merchant's reconciliation actually perform.
create index if not exists orders_ap_transactionid_idx
  on public.orders (ap_transactionid)
  where ap_transactionid is not null;

create index if not exists orders_created_at_idx on public.orders (created_at desc);

create index if not exists orders_unsettled_idx
  on public.orders (created_at desc)
  where payment_status in ('initiated', 'pending');

-- ─── updated_at maintenance ─────────────────────────────────────────────────
-- Reuses the trigger function defined in 0001_init.sql.

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- RLS is enabled with DELIBERATELY NO POLICIES. Under Postgres RLS, a table
-- with no matching policy denies everything, so the anon key that ships in the
-- browser bundle can neither read nor write an order. That is the intent: these
-- rows hold shipping addresses and the authoritative payable amount.
--
-- Only SUPABASE_SERVICE_ROLE — held exclusively by the Vercel Functions in
-- api/ — reaches this table, and the service role bypasses RLS.

alter table public.orders enable row level security;
