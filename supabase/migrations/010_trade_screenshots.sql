-- Allow traders to attach a chart screenshot to a trade, shared into the squad feed
alter table trades add column if not exists screenshot_url text;
alter table squad_posts add column if not exists screenshot_url text;

notify pgrst, 'reload schema';
