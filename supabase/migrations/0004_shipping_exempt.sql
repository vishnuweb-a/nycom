-- ============================================================================
-- Yarnvia — product-level shipping exemption
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Shipping has until now been a pure function of the basket total: below
-- `FREE_SHIPPING_THRESHOLD` a flat `SHIPPING_FEE` applies, at or above it
-- shipping is free. Nothing about the product itself could waive the fee.
--
-- This column adds that one missing lever, for goods that genuinely carry no
-- delivery cost. It is NOT NULL DEFAULT false, so every row that already exists
-- becomes explicitly non-exempt and the live shipping rule is unchanged for the
-- entire catalogue. Only a row that opts in by setting it true behaves
-- differently.
--
-- The exemption is honoured only when EVERY line in a basket is exempt — see
-- `api/_lib/pricing.ts`. A single exempt item cannot waive the fee for a
-- basket of normal goods.
-- ============================================================================

alter table public.products
  add column if not exists shipping_exempt boolean not null default false;

comment on column public.products.shipping_exempt is
  'When true, a basket consisting solely of such products ships free regardless of the free-shipping threshold. Defaults to false; normal goods must not set it.';
