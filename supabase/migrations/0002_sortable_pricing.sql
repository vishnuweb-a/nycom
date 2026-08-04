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
