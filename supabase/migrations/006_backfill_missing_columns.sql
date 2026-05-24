-- Add missing columns to sessions table (safe to re-run)
alter table sessions add column if not exists trading_session text;
alter table sessions add column if not exists pre_emotional_state text;
alter table sessions add column if not exists has_setup boolean;
alter table sessions add column if not exists debrief_responses jsonb;
alter table sessions add column if not exists end_time timestamptz;

-- Add missing columns to trades table (safe to re-run)
alter table trades add column if not exists setup_type_id uuid references setup_types(id);
alter table trades add column if not exists confluence_count int not null default 0;
alter table trades add column if not exists emotional_state text;
alter table trades add column if not exists contract_size numeric not null default 1;
alter table trades add column if not exists trade_story text;

-- Notify PostgREST to reload its schema cache
notify pgrst, 'reload schema';
