create extension if not exists "uuid-ossp";

-- Traders (extends auth.users)
create table traders (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  timezone text not null default 'Australia/Sydney',
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

-- Prop firm rules (seeded)
create table prop_firm_rules (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  dll_amount numeric not null,
  max_drawdown numeric not null,
  profit_target numeric not null,
  drawdown_type text not null check (drawdown_type in ('trailing', 'static')),
  min_trading_days int not null default 0,
  reset_time time not null default '17:00',
  reset_timezone text not null default 'America/Chicago',
  is_custom boolean not null default false
);

create table prop_accounts (
  id uuid primary key default uuid_generate_v4(),
  trader_id uuid not null references traders(id) on delete cascade,
  firm_id uuid references prop_firm_rules(id),
  nickname text not null,
  starting_balance numeric not null,
  current_balance numeric not null,
  status text not null default 'active' check (status in ('active', 'passed', 'failed')),
  created_at timestamptz not null default now()
);

create table setup_types (
  id uuid primary key default uuid_generate_v4(),
  trader_id uuid not null references traders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default uuid_generate_v4(),
  prop_account_id uuid not null references prop_accounts(id) on delete cascade,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  trading_session text check (trading_session in ('LONDON', 'NY_OPEN', 'NY_CLOSE', 'ASIA', 'OTHER')),
  pre_emotional_state text,
  has_setup boolean,
  debrief_responses jsonb,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

create table trades (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  instrument text not null,
  direction text not null check (direction in ('long', 'short')),
  entry_time timestamptz not null default now(),
  result text not null check (result in ('win', 'loss', 'breakeven')),
  pnl numeric not null,
  setup_type_id uuid references setup_types(id),
  confluence_count int not null default 0,
  emotional_state text,
  contract_size numeric not null default 1,
  trade_story text,
  created_at timestamptz not null default now()
);

create table circuit_breaker_events (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  threshold_pct int not null check (threshold_pct in (50, 80)),
  triggered_at timestamptz not null default now(),
  q1_response text,
  q2_response text,
  q3_response text,
  action_taken text check (action_taken in ('continued', 'ended_session'))
);

-- RLS
alter table traders enable row level security;
alter table prop_accounts enable row level security;
alter table setup_types enable row level security;
alter table sessions enable row level security;
alter table trades enable row level security;
alter table circuit_breaker_events enable row level security;
alter table prop_firm_rules enable row level security;

-- Policies
create policy "own_trader" on traders for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own_prop_accounts" on prop_accounts for all using (trader_id = auth.uid()) with check (trader_id = auth.uid());
create policy "own_setup_types" on setup_types for all using (trader_id = auth.uid()) with check (trader_id = auth.uid());

create policy "own_sessions_select" on sessions for select using (
  prop_account_id in (select id from prop_accounts where trader_id = auth.uid())
);
create policy "own_sessions_insert" on sessions for insert with check (
  prop_account_id in (select id from prop_accounts where trader_id = auth.uid())
);
create policy "own_sessions_update" on sessions for update using (
  prop_account_id in (select id from prop_accounts where trader_id = auth.uid())
);

create policy "own_trades_select" on trades for select using (
  session_id in (
    select s.id from sessions s
    join prop_accounts pa on pa.id = s.prop_account_id
    where pa.trader_id = auth.uid()
  )
);
create policy "own_trades_insert" on trades for insert with check (
  session_id in (
    select s.id from sessions s
    join prop_accounts pa on pa.id = s.prop_account_id
    where pa.trader_id = auth.uid()
  )
);
create policy "own_trades_update" on trades for update using (
  session_id in (
    select s.id from sessions s
    join prop_accounts pa on pa.id = s.prop_account_id
    where pa.trader_id = auth.uid()
  )
);

create policy "own_cb_events" on circuit_breaker_events for all using (
  session_id in (
    select s.id from sessions s
    join prop_accounts pa on pa.id = s.prop_account_id
    where pa.trader_id = auth.uid()
  )
);

create policy "firm_rules_public" on prop_firm_rules for select to anon, authenticated using (true);

-- Auto-create trader profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.traders (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
