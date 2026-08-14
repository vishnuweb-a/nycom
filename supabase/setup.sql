-- ============================================================================
-- Yarnvia -- full database setup (new Supabase project)
--
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query
-- and Run. It is the concatenation of supabase/migrations/0001..0003 and every
-- statement is idempotent, so re-running it is safe.
-- ============================================================================


-- >>> supabase/migrations/0001_init.sql <<<

-- ============================================================================
-- Yarnvia — initial schema
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ─── Categories ─────────────────────────────────────────────────────────────

create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  slug          text        not null unique,
  description   text,
  cover_image   jsonb,                            -- { secure_url, public_id }
  display_order integer     not null default 0,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- ─── Products ───────────────────────────────────────────────────────────────

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),

  -- Basic information
  title            text not null,
  subtitle         text,
  ribbon           text,                          -- e.g. "Bestseller", "New In"
  description      text not null,
  images           jsonb not null default '[]'::jsonb,  -- [{ secure_url, public_id, alt, width, height }]
  thumbnail        jsonb,                         -- { secure_url, public_id, alt, width, height }

  -- Pricing
  price            numeric(10, 2) not null check (price >= 0),
  discount_price   numeric(10, 2) check (discount_price >= 0),
  sku              text not null unique,
  weight_grams     integer check (weight_grams >= 0),
  track_quantity   boolean not null default true,

  -- Classification
  category         text not null references public.categories (slug) on update cascade,
  gender           text not null,
  brand            text not null,
  collection       text,
  season           text,
  material         text,
  occasion         text,

  -- Variants: [{ size, color, quantity, stock }]
  variants         jsonb not null default '[]'::jsonb,

  -- Social proof (required by prd.md §8 product card)
  rating           numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count     integer not null default 0 check (review_count >= 0),

  -- Display flags
  featured         boolean not null default false,
  top_selling      boolean not null default false,
  new_arrival      boolean not null default false,
  trending         boolean not null default false,
  active           boolean not null default true,

  -- SEO
  slug             text not null unique,
  meta_title       text,
  meta_description text,

  -- Metadata
  tags             text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- A discount must actually be a discount.
  constraint discount_below_price check (discount_price is null or discount_price <= price)
);

-- ─── Carousel ───────────────────────────────────────────────────────────────

create table if not exists public.carousel (
  id            uuid primary key default gen_random_uuid(),
  title         text        not null,
  subtitle      text,
  image         jsonb       not null,             -- { secure_url, public_id, alt, width, height }
  button_text   text,
  button_link   text,
  display_order integer     not null default 0,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- ─── Newsletter subscribers ─────────────────────────────────────────────────

create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text        not null unique,
  created_at timestamptz not null default now()
);

-- ─── Contact queries ────────────────────────────────────────────────────────

create table if not exists public.contact_queries (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  email      text        not null,
  phone      text,
  subject    text        not null,
  message    text        not null,
  status     text        not null default 'new',
  created_at timestamptz not null default now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

create index if not exists products_category_idx     on public.products (category) where active;
create index if not exists products_featured_idx     on public.products (category) where active and featured;
create index if not exists products_top_selling_idx  on public.products (category) where active and top_selling;
create index if not exists products_new_arrival_idx  on public.products (category) where active and new_arrival;
create index if not exists products_created_at_idx   on public.products (created_at desc);
create index if not exists products_tags_idx         on public.products using gin (tags);
create index if not exists carousel_order_idx        on public.carousel (display_order) where active;
create index if not exists categories_order_idx      on public.categories (display_order) where active;

-- ─── updated_at maintenance ─────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- The anon key ships in the browser bundle, so it must never be able to write.
-- Reads are limited to active rows. The service role bypasses RLS for seeding.

alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.carousel   enable row level security;

drop policy if exists "Public read active categories" on public.categories;
create policy "Public read active categories"
  on public.categories for select to anon, authenticated using (active);

drop policy if exists "Public read active products" on public.products;
create policy "Public read active products"
  on public.products for select to anon, authenticated using (active);

drop policy if exists "Public read active carousel" on public.carousel;
create policy "Public read active carousel"
  on public.carousel for select to anon, authenticated using (active);

-- Submissions are write-only for the public: anyone may insert, nobody may read
-- back. Without a select policy these tables are not readable with the anon key.
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_queries        enable row level security;

drop policy if exists "Public subscribe" on public.newsletter_subscribers;
create policy "Public subscribe"
  on public.newsletter_subscribers for insert to anon, authenticated with check (true);

drop policy if exists "Public submit query" on public.contact_queries;
create policy "Public submit query"
  on public.contact_queries for insert to anon, authenticated with check (true);

-- ─── Seed categories ────────────────────────────────────────────────────────
-- prd.md §5. Men and Children are created now and stocked when their
-- photography is supplied; the storefront renders honest empty states for them.

insert into public.categories (name, slug, description, display_order) values
  ('Women',    'women',    'Sarees, ethnic wear and everyday essentials for women.', 1),
  ('Men',      'men',      'Shirts, tees and everyday essentials for men.',          2),
  ('Children', 'children', 'Comfortable, playful styles for children.',              3)
on conflict (slug) do update
  set name        = excluded.name,
      description = excluded.description,
      display_order = excluded.display_order;

-- >>> supabase/migrations/0002_sortable_pricing.sql <<<

-- ============================================================================
-- Yarnvia — sortable pricing columns
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- PostgREST can only order by real columns, never by an expression. Sorting the
-- Shop grid by the price a shopper actually pays requires
-- coalesce(discount_price, price) to exist as a column, and the "Highest
-- discount" sort requires the percentage to exist as a column.
--
-- Both are STORED GENERATED columns: Postgres maintains them automatically on
-- every insert and update, so they can never drift from the source values, and
-- they are indexable.
-- ============================================================================

alter table public.products
  add column if not exists effective_price numeric(10, 2)
    generated always as (coalesce(discount_price, price)) stored;

alter table public.products
  add column if not exists discount_pct integer
    generated always as (
      case
        when discount_price is null or price <= 0 then 0
        else floor(((price - discount_price) / price) * 100)::integer
      end
    ) stored;

-- Indexes backing the Shop sort options.
create index if not exists products_effective_price_idx
  on public.products (effective_price) where active;

create index if not exists products_discount_pct_idx
  on public.products (discount_pct desc) where active;

create index if not exists products_rating_idx
  on public.products (rating desc) where active;

-- Backing indexes for the Shop facets.
create index if not exists products_brand_idx    on public.products (brand) where active;
create index if not exists products_material_idx on public.products (material) where active;

-- >>> supabase/migrations/0003_orders.sql <<<

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

  -- pending | initiated | paid | failed | cancelled
  payment_status    text not null default 'pending'
                    check (payment_status in ('pending', 'initiated', 'paid', 'failed', 'cancelled')),

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
