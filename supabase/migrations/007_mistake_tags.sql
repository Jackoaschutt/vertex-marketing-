alter table trades add column if not exists mistake_tags text[] not null default '{}';
