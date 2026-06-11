-- Squad Hub v2: private squads with invite codes (replaces single global feed)

create table squads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text not null unique,
  owner_id uuid not null references traders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table squad_members (
  squad_id uuid not null references squads(id) on delete cascade,
  trader_id uuid not null references traders(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (squad_id, trader_id),
  unique (trader_id)
);

alter table squad_posts add column if not exists squad_id uuid references squads(id) on delete cascade;

alter table squads enable row level security;
alter table squad_members enable row level security;

-- Security-definer helper avoids RLS recursion on squad_members
create or replace function public.is_squad_member(p_squad_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from squad_members
    where squad_id = p_squad_id and trader_id = auth.uid()
  );
$$;

create policy "squads_select" on squads for select using (is_squad_member(id));
create policy "squads_insert" on squads for insert with check (owner_id = auth.uid());

-- Lets a non-member look up a squad by invite code in order to join it
create or replace function public.find_squad_by_code(p_invite_code text)
returns squads
language sql
security definer
set search_path = public
stable
as $$
  select * from squads where invite_code = p_invite_code;
$$;

create policy "squad_members_select" on squad_members for select using (
  trader_id = auth.uid() or is_squad_member(squad_id)
);
create policy "squad_members_insert" on squad_members for insert with check (trader_id = auth.uid());
create policy "squad_members_delete" on squad_members for delete using (trader_id = auth.uid());

-- Replace global squad_posts/comments/reactions policies with squad-scoped ones
drop policy if exists "squad_posts_select" on squad_posts;
drop policy if exists "squad_posts_insert" on squad_posts;
drop policy if exists "squad_comments_select" on squad_comments;
drop policy if exists "squad_comments_insert" on squad_comments;
drop policy if exists "squad_reactions_select" on squad_reactions;
drop policy if exists "squad_reactions_insert" on squad_reactions;
drop policy if exists "squad_reactions_delete" on squad_reactions;

create policy "squad_posts_select" on squad_posts for select using (
  squad_id is not null and is_squad_member(squad_id)
);
create policy "squad_posts_insert" on squad_posts for insert with check (
  trader_id = auth.uid() and squad_id is not null and is_squad_member(squad_id)
);

create policy "squad_comments_select" on squad_comments for select using (
  post_id in (select id from squad_posts where squad_id is not null and is_squad_member(squad_id))
);
create policy "squad_comments_insert" on squad_comments for insert with check (
  trader_id = auth.uid() and post_id in (select id from squad_posts where squad_id is not null and is_squad_member(squad_id))
);

create policy "squad_reactions_select" on squad_reactions for select using (
  post_id in (select id from squad_posts where squad_id is not null and is_squad_member(squad_id))
);
create policy "squad_reactions_insert" on squad_reactions for insert with check (
  trader_id = auth.uid() and post_id in (select id from squad_posts where squad_id is not null and is_squad_member(squad_id))
);
create policy "squad_reactions_delete" on squad_reactions for delete using (trader_id = auth.uid());

notify pgrst, 'reload schema';
