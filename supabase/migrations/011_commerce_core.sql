-- 011_commerce_core.sql
-- Vesper Commerce: dropshipping storefront, research, supplier, order and analytics core.
--
-- Namespacing: every table is prefixed `ds_` so this schema coexists with the
-- existing PropGuard tables (migrations 001-010) without any collision.
--
-- Money: ALL monetary columns are integer MINOR UNITS (cents). Never floats.
-- Currency is stored per-order; catalogue prices assume ds_settings.default_currency.
--
-- Security: RLS is enabled on every table with NO permissive policies. All access
-- is server-side via the service-role key (see lib/commerce/db/driver-supabase.ts).
-- The anon key can read nothing here.

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
create table if not exists ds_suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  -- which SupplierAdapter drives this supplier: 'mock' | 'cj' | 'http'
  adapter       text not null default 'mock',
  -- non-secret adapter configuration (base urls, field maps). Secrets live in env.
  config        jsonb not null default '{}'::jsonb,
  website       text,
  contact_email text,
  default_ship_days_min int not null default 7,
  default_ship_days_max int not null default 14,
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Products — catalogue record AND research record in one row.
-- ---------------------------------------------------------------------------
create table if not exists ds_products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  tagline       text,
  category      text,
  target_audience text,
  problem_solved  text,

  supplier_id   uuid references ds_suppliers(id) on delete set null,
  supplier_url  text,
  product_url   text,

  -- economics, minor units
  cost_cents           integer not null default 0,
  shipping_cost_cents  integer not null default 0,
  price_cents          integer not null default 0,
  compare_at_cents     integer,        -- only set when a genuine higher price existed

  ship_days_min integer not null default 7,
  ship_days_max integer not null default 14,

  -- research scores. Components are 0..max; product_score is the 0..100 total.
  demand_score        integer not null default 0,  -- 0..20
  margin_score        integer not null default 0,  -- 0..15
  competition_score   integer not null default 0,  -- 0..15
  problem_score       integer not null default 0,  -- 0..15
  creative_score      integer not null default 0,  -- 0..10
  brandability_score  integer not null default 0,  -- 0..10
  shipping_score      integer not null default 0,  -- 0..5
  repeat_score        integer not null default 0,  -- 0..5
  risk_score          integer not null default 0,  -- 0..5 (higher = lower risk)
  product_score       integer not null default 0,  -- 0..100

  -- free-form research inputs kept for auditability of the score
  research_inputs jsonb not null default '{}'::jsonb,

  status        text not null default 'researching',
  -- researching | validation | approved | rejected | testing | winner | loser | scaling
  published     boolean not null default false,
  featured      boolean not null default false,
  position      integer not null default 0,

  -- cumulative performance (denormalised for fast dashboards; recomputable)
  ad_spend_cents  integer not null default 0,
  revenue_cents   integer not null default 0,
  orders_count    integer not null default 0,
  sessions_count  integer not null default 0,
  refunds_cents   integer not null default 0,
  refunds_count   integer not null default 0,

  meta_title       text,
  meta_description text,

  date_discovered timestamptz not null default now(),
  date_tested     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint ds_products_status_check check (status in
    ('researching','validation','approved','rejected','testing','winner','loser','scaling'))
);

create index if not exists ds_products_status_idx     on ds_products(status);
create index if not exists ds_products_published_idx  on ds_products(published);
create index if not exists ds_products_score_idx      on ds_products(product_score desc);

create table if not exists ds_product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references ds_products(id) on delete cascade,
  sku         text not null unique,
  title       text not null default 'Default',
  options     jsonb not null default '{}'::jsonb,   -- {"colour":"Sand","size":"M"}
  price_cents integer not null default 0,
  cost_cents  integer not null default 0,
  stock       integer,                              -- null = untracked
  is_default  boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ds_product_variants_product_idx on ds_product_variants(product_id);

create table if not exists ds_product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references ds_products(id) on delete cascade,
  url         text not null,
  alt         text not null default '',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ds_product_images_product_idx on ds_product_images(product_id);

-- Versioned copy. `is_ai` + `generator` make AI-written content auditable.
create table if not exists ds_product_content (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references ds_products(id) on delete cascade,
  version     integer not null default 1,
  is_ai       boolean not null default false,
  generator   text not null default 'manual',   -- manual | anthropic | fallback
  model       text,
  payload     jsonb not null default '{}'::jsonb,
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists ds_product_content_product_idx on ds_product_content(product_id);

-- Variant -> supplier SKU. Many suppliers may stock the same variant.
create table if not exists ds_supplier_products (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null references ds_suppliers(id) on delete cascade,
  variant_id          uuid not null references ds_product_variants(id) on delete cascade,
  supplier_sku        text not null,
  supplier_cost_cents integer not null default 0,
  supplier_ship_cents integer not null default 0,
  lead_days           integer not null default 2,
  is_primary          boolean not null default true,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (supplier_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- Customers & orders
-- ---------------------------------------------------------------------------
create table if not exists ds_customers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  phone         text,
  marketing_opt_in boolean not null default false,
  orders_count  integer not null default 0,
  spend_cents   integer not null default 0,
  first_order_at timestamptz,
  last_order_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists ds_orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text not null unique,
  customer_id   uuid references ds_customers(id) on delete set null,
  email         text not null,
  currency      text not null default 'USD',

  subtotal_cents    integer not null default 0,
  shipping_cents    integer not null default 0,
  tax_cents         integer not null default 0,
  discount_cents    integer not null default 0,
  total_cents       integer not null default 0,
  payment_fee_cents integer not null default 0,
  cogs_cents        integer not null default 0,
  refund_cents      integer not null default 0,

  status  text not null default 'received',
  -- received | validated | routed | submitted | fulfilled | delivered
  -- | needs_attention | cancelled | refunded
  attention_reason text,

  shipping_address jsonb not null default '{}'::jsonb,
  attribution      jsonb not null default '{}'::jsonb,

  stripe_session_id        text unique,
  stripe_payment_intent_id text,

  placed_at    timestamptz not null default now(),
  fulfilled_at timestamptz,
  delivered_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint ds_orders_status_check check (status in
    ('received','validated','routed','submitted','fulfilled','delivered',
     'needs_attention','cancelled','refunded'))
);
create index if not exists ds_orders_status_idx    on ds_orders(status);
create index if not exists ds_orders_placed_at_idx on ds_orders(placed_at desc);
create index if not exists ds_orders_email_idx     on ds_orders(email);

create table if not exists ds_order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references ds_orders(id) on delete cascade,
  product_id   uuid references ds_products(id) on delete set null,
  variant_id   uuid references ds_product_variants(id) on delete set null,
  supplier_id  uuid references ds_suppliers(id) on delete set null,
  sku          text not null,
  title        text not null,
  quantity     integer not null default 1,
  -- snapshots at time of sale: later catalogue edits must not rewrite history
  unit_price_cents integer not null default 0,
  unit_cost_cents  integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists ds_order_items_order_idx on ds_order_items(order_id);

create table if not exists ds_fulfillments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references ds_orders(id) on delete cascade,
  supplier_id     uuid references ds_suppliers(id) on delete set null,
  supplier_ref    text,
  status          text not null default 'pending',
  -- pending | submitted | processing | shipped | delivered | failed | cancelled
  tracking_number text,
  tracking_url    text,
  carrier         text,
  cost_cents      integer not null default 0,
  error_message   text,
  submitted_at    timestamptz,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (order_id, supplier_id)
);
create index if not exists ds_fulfillments_order_idx on ds_fulfillments(order_id);

-- ---------------------------------------------------------------------------
-- Marketing, expenses, automation
-- ---------------------------------------------------------------------------
create table if not exists ds_ad_metrics (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references ds_products(id) on delete cascade,
  channel      text not null,           -- meta | tiktok | google | other
  campaign_ref text,
  day          date not null,
  impressions  integer not null default 0,
  clicks       integer not null default 0,
  spend_cents  integer not null default 0,
  purchases    integer not null default 0,
  revenue_cents integer not null default 0,
  source       text not null default 'manual',  -- manual | api | import
  created_at   timestamptz not null default now(),
  unique (product_id, channel, campaign_ref, day)
);
create index if not exists ds_ad_metrics_day_idx on ds_ad_metrics(day desc);

create table if not exists ds_expenses (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  category    text not null default 'other',
  amount_cents integer not null default 0,
  day         date not null default current_date,
  recurring   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists ds_recommendations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,     -- scale | pause | price | creative | restock | investigate
  severity    text not null default 'info',  -- info | warning | critical
  product_id  uuid references ds_products(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  evidence    jsonb not null default '{}'::jsonb,
  status      text not null default 'open',  -- open | done | dismissed
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists ds_recommendations_status_idx on ds_recommendations(status);

create table if not exists ds_events (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  level      text not null default 'info',   -- info | warn | error
  message    text not null,
  order_id   uuid references ds_orders(id) on delete set null,
  product_id uuid references ds_products(id) on delete set null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ds_events_created_idx on ds_events(created_at desc);
create index if not exists ds_events_level_idx   on ds_events(level);

create table if not exists ds_email_log (
  id         uuid primary key default gen_random_uuid(),
  template   text not null,
  to_email   text not null,
  subject    text not null,
  order_id   uuid references ds_orders(id) on delete set null,
  transport  text not null default 'console',
  status     text not null default 'sent',  -- sent | failed | skipped
  error      text,
  created_at timestamptz not null default now(),
  -- dedupe guard: one send per template per order. Webhook replays cannot spam.
  unique (order_id, template)
);

create table if not exists ds_abandoned_carts (
  id          uuid primary key default gen_random_uuid(),
  email       text,
  items       jsonb not null default '[]'::jsonb,
  value_cents integer not null default 0,
  recovered   boolean not null default false,
  reminded_at timestamptz,
  attribution jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists ds_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: locked by default. Server-side service-role access only.
-- ---------------------------------------------------------------------------
alter table ds_suppliers          enable row level security;
alter table ds_products           enable row level security;
alter table ds_product_variants   enable row level security;
alter table ds_product_images     enable row level security;
alter table ds_product_content    enable row level security;
alter table ds_supplier_products  enable row level security;
alter table ds_customers          enable row level security;
alter table ds_orders             enable row level security;
alter table ds_order_items        enable row level security;
alter table ds_fulfillments       enable row level security;
alter table ds_ad_metrics         enable row level security;
alter table ds_expenses           enable row level security;
alter table ds_recommendations    enable row level security;
alter table ds_events             enable row level security;
alter table ds_email_log          enable row level security;
alter table ds_abandoned_carts    enable row level security;
alter table ds_settings           enable row level security;

-- No policies are created on purpose. With RLS enabled and no policy, the anon
-- and authenticated roles can read/write nothing. The service-role key bypasses
-- RLS entirely and is the only path the application uses.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function ds_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'ds_suppliers','ds_products','ds_product_variants','ds_customers',
    'ds_orders','ds_fulfillments'
  ] loop
    execute format(
      'drop trigger if exists %I_touch on %I; '
      'create trigger %I_touch before update on %I '
      'for each row execute function ds_touch_updated_at();',
      t, t, t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Baseline settings
-- ---------------------------------------------------------------------------
insert into ds_settings (key, value) values
  ('default_currency',      '"USD"'::jsonb),
  ('payment_fee_percent',   '2.9'::jsonb),
  ('payment_fee_fixed_cents','30'::jsonb),
  ('target_roas',           '2.0'::jsonb),
  ('low_stock_threshold',   '10'::jsonb)
on conflict (key) do nothing;
