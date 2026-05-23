alter table traders
  add column if not exists tradovate_username text,
  add column if not exists tradovate_password text;
