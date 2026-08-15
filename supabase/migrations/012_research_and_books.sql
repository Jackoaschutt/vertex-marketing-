-- 012_research_and_books.sql
--
-- Turns the system from a storefront into a private research and bookkeeping
-- tool. The owner does not sell from this app — they research products here,
-- sell wherever they sell, and keep the books here.
--
-- Consequences for the schema:
--
--   * Selling machinery goes. Orders, order items, fulfilments, customers,
--     email logs and abandoned carts only existed to run a checkout.
--   * Revenue arrives as a hand-entered daily ledger (ds_sales) rather than
--     from a payment webhook. Daily-per-product-per-channel is the grain:
--     it produces the same P&L as per-order rows for a fraction of the typing.
--   * The denormalised counters on ds_products are removed. A bookkeeping tool
--     must have exactly one source of truth for revenue, and that is the
--     ledger. Every figure is computed, never stored twice.
--   * Storefront columns (published, featured, position, compare-at price, SEO
--     meta) are removed because there is no storefront.
--
-- Money is still integer minor units everywhere. RLS is still enabled with no
-- policies: service-role access only.

-- ---------------------------------------------------------------------------
-- Remove the selling machinery
-- ---------------------------------------------------------------------------
drop table if exists ds_order_items    cascade;
drop table if exists ds_fulfillments   cascade;
drop table if exists ds_orders         cascade;
drop table if exists ds_customers      cascade;
drop table if exists ds_email_log      cascade;
drop table if exists ds_abandoned_carts cascade;

-- Variants and supplier SKU mapping existed to route an order to a supplier.
-- Product-level cost and price carry the margin maths on their own.
drop table if exists ds_supplier_products cascade;
drop table if exists ds_product_variants  cascade;

-- ---------------------------------------------------------------------------
-- Trim ds_products to research + economics
-- ---------------------------------------------------------------------------
alter table ds_products drop column if exists published;
alter table ds_products drop column if exists featured;
alter table ds_products drop column if exists position;
alter table ds_products drop column if exists compare_at_cents;
alter table ds_products drop column if exists meta_title;
alter table ds_products drop column if exists meta_description;

-- Derived from the ledger now. Storing them invited two answers to one question.
alter table ds_products drop column if exists ad_spend_cents;
alter table ds_products drop column if exists revenue_cents;
alter table ds_products drop column if exists orders_count;
alter table ds_products drop column if exists sessions_count;
alter table ds_products drop column if exists refunds_cents;
alter table ds_products drop column if exists refunds_count;

-- Where the owner actually sells this one, so the ledger and the research agree.
alter table ds_products add column if not exists sell_channel text;

-- ---------------------------------------------------------------------------
-- Sales ledger — hand entered
-- ---------------------------------------------------------------------------
create table if not exists ds_sales (
  id            uuid primary key default gen_random_uuid(),
  day           date not null,
  product_id    uuid references ds_products(id) on delete cascade,
  channel       text not null default 'other',
  units         integer not null default 0,
  revenue_cents integer not null default 0,
  cogs_cents    integer not null default 0,
  shipping_cost_cents integer not null default 0,
  fees_cents    integer not null default 0,
  refunds_cents integer not null default 0,
  refund_units  integer not null default 0,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One row per product per channel per day. Re-entering a day corrects it
  -- rather than double-counting.
  unique (day, product_id, channel)
);
create index if not exists ds_sales_day_idx     on ds_sales(day desc);
create index if not exists ds_sales_product_idx on ds_sales(product_id);

-- ---------------------------------------------------------------------------
-- Playbook — what the owner learns, kept next to what it was learned from
-- ---------------------------------------------------------------------------
create table if not exists ds_notes (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  kind       text not null default 'note',   -- note | lesson | idea | source
  tags       text[] not null default '{}',
  product_id uuid references ds_products(id) on delete set null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ds_notes_kind_check check (kind in ('note','lesson','idea','source'))
);
create index if not exists ds_notes_product_idx on ds_notes(product_id);
create index if not exists ds_notes_created_idx on ds_notes(created_at desc);

-- ---------------------------------------------------------------------------
-- Stage checklists — the process, made to be followed
-- ---------------------------------------------------------------------------
create table if not exists ds_checklist_progress (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references ds_products(id) on delete cascade,
  stage        text not null,
  item_key     text not null,
  done         boolean not null default false,
  note         text,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (product_id, stage, item_key)
);
create index if not exists ds_checklist_product_idx on ds_checklist_progress(product_id);

-- ---------------------------------------------------------------------------
-- Post-mortems — why it won or died, in the owner's own words
-- ---------------------------------------------------------------------------
create table if not exists ds_postmortems (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references ds_products(id) on delete cascade,
  outcome        text not null default 'undecided',  -- winner | loser | undecided
  what_happened  text not null default '',
  what_worked    text not null default '',
  what_failed    text not null default '',
  next_time      text not null default '',
  -- Tagged causes, so patterns across products can be counted rather than felt.
  factors        text[] not null default '{}',
  -- Figures at the moment of writing, so the story cannot drift from the books.
  snapshot       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id),
  constraint ds_postmortems_outcome_check check (outcome in ('winner','loser','undecided'))
);

-- ---------------------------------------------------------------------------
-- Collected research signals — real fetched data, never invented
-- ---------------------------------------------------------------------------
create table if not exists ds_research_signals (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid references ds_products(id) on delete cascade,
  keyword           text not null,
  source            text not null,           -- serpapi_trends | serpapi_shopping | manual
  -- The provider's response as returned, so a score can always be traced back.
  payload           jsonb not null default '{}'::jsonb,
  trend_direction   text,                    -- rising | flat | falling | unknown
  trend_score       integer,                 -- 0..100, derived from the payload
  competition_count integer,
  collected_at      timestamptz not null default now(),
  unique (product_id, keyword, source)
);
create index if not exists ds_research_signals_product_idx on ds_research_signals(product_id);

-- ---------------------------------------------------------------------------
-- Security + updated_at
-- ---------------------------------------------------------------------------
alter table ds_sales              enable row level security;
alter table ds_notes              enable row level security;
alter table ds_checklist_progress enable row level security;
alter table ds_postmortems        enable row level security;
alter table ds_research_signals   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ds_sales','ds_notes','ds_postmortems'] loop
    execute format(
      'drop trigger if exists %I_touch on %I; '
      'create trigger %I_touch before update on %I '
      'for each row execute function ds_touch_updated_at();',
      t, t, t, t);
  end loop;
end;
$$;

insert into ds_settings (key, value) values
  ('sell_channels', '["shopify","tiktok","amazon","etsy","ebay","own","other"]'::jsonb)
on conflict (key) do nothing;
