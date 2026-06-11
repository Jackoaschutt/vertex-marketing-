-- Squad Hub: shared feed of logged trades with comments and emoji reactions
create table squad_posts (
  id uuid primary key default uuid_generate_v4(),
  trader_id uuid not null references traders(id) on delete cascade,
  trade_id uuid references trades(id) on delete set null,
  instrument text not null,
  direction text not null check (direction in ('long', 'short')),
  result text not null check (result in ('win', 'loss', 'breakeven')),
  pnl numeric not null,
  confluence_count int not null default 0,
  emotional_state text,
  mistake_tags text[] not null default '{}',
  trade_story text,
  created_at timestamptz not null default now()
);

create table squad_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references squad_posts(id) on delete cascade,
  trader_id uuid not null references traders(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table squad_reactions (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references squad_posts(id) on delete cascade,
  trader_id uuid not null references traders(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, trader_id, emoji)
);

alter table squad_posts enable row level security;
alter table squad_comments enable row level security;
alter table squad_reactions enable row level security;

-- Every signed-in trader can see the shared feed, but can only post as themselves
create policy "squad_posts_select" on squad_posts for select to authenticated using (true);
create policy "squad_posts_insert" on squad_posts for insert with check (trader_id = auth.uid());

create policy "squad_comments_select" on squad_comments for select to authenticated using (true);
create policy "squad_comments_insert" on squad_comments for insert with check (trader_id = auth.uid());

create policy "squad_reactions_select" on squad_reactions for select to authenticated using (true);
create policy "squad_reactions_insert" on squad_reactions for insert with check (trader_id = auth.uid());
create policy "squad_reactions_delete" on squad_reactions for delete using (trader_id = auth.uid());

notify pgrst, 'reload schema';
