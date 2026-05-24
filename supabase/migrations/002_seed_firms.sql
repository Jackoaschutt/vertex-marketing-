insert into prop_firm_rules (name, dll_amount, max_drawdown, profit_target, drawdown_type, min_trading_days, reset_time, reset_timezone) values
  -- Apex
  ('Apex 25K',   500,  1500,  1500, 'trailing', 7, '17:00', 'America/Chicago'),
  ('Apex 50K',  1000,  2500,  3000, 'trailing', 7, '17:00', 'America/Chicago'),
  ('Apex 100K', 2000,  5000,  6000, 'trailing', 7, '17:00', 'America/Chicago'),
  ('Apex 150K', 3000,  7500,  9000, 'trailing', 7, '17:00', 'America/Chicago'),
  ('Apex 300K', 5000, 12500, 18000, 'trailing', 7, '17:00', 'America/Chicago'),

  -- Topstep
  ('Topstep 50K',   1000,  2000,  3000, 'trailing', 5, '17:00', 'America/Chicago'),
  ('Topstep 100K',  2000,  3000,  6000, 'trailing', 5, '17:00', 'America/Chicago'),
  ('Topstep 150K',  3000,  4500,  9000, 'trailing', 5, '17:00', 'America/Chicago'),

  -- FTMO
  ('FTMO 10K',   500,  1000,  1000, 'static', 10, '22:00', 'Europe/Prague'),
  ('FTMO 25K',  1250,  2500,  2500, 'static', 10, '22:00', 'Europe/Prague'),
  ('FTMO 50K',  2500,  5000,  5000, 'static', 10, '22:00', 'Europe/Prague'),
  ('FTMO 100K', 5000, 10000, 10000, 'static', 10, '22:00', 'Europe/Prague'),
  ('FTMO 200K',10000, 20000, 20000, 'static', 10, '22:00', 'Europe/Prague'),

  -- MyFundedFutures
  ('MyFundedFutures 50K',  1000, 2500, 3000, 'trailing', 0, '17:00', 'America/Chicago'),
  ('MyFundedFutures 100K', 2000, 4500, 6000, 'trailing', 0, '17:00', 'America/Chicago'),
  ('MyFundedFutures 150K', 3000, 6750, 9000, 'trailing', 0, '17:00', 'America/Chicago'),

  -- FundedNext
  ('FundedNext 6K',   300,   600,   360, 'static', 5, '00:00', 'UTC'),
  ('FundedNext 15K',  750,  1500,   900, 'static', 5, '00:00', 'UTC'),
  ('FundedNext 25K', 1250,  2500,  1500, 'static', 5, '00:00', 'UTC'),
  ('FundedNext 50K', 2500,  5000,  3000, 'static', 5, '00:00', 'UTC'),
  ('FundedNext 100K',5000, 10000,  6000, 'static', 5, '00:00', 'UTC'),

  -- TradeDay
  ('TradeDay 10K',   500,  1000,  1000, 'trailing', 0, '17:00', 'America/Chicago'),
  ('TradeDay 25K',   625,  1500,  1750, 'trailing', 0, '17:00', 'America/Chicago'),
  ('TradeDay 50K',  1000,  2500,  3000, 'trailing', 0, '17:00', 'America/Chicago'),
  ('TradeDay 100K', 2000,  5000,  6000, 'trailing', 0, '17:00', 'America/Chicago'),

  -- Elite Trader Funding
  ('ETF 25K',   500,  1500, 1500, 'trailing', 5, '17:00', 'America/Chicago'),
  ('ETF 50K',  1000,  2500, 3000, 'trailing', 5, '17:00', 'America/Chicago'),
  ('ETF 100K', 2000,  5000, 6000, 'trailing', 5, '17:00', 'America/Chicago'),
  ('ETF 150K', 3000,  7500, 9000, 'trailing', 5, '17:00', 'America/Chicago');
