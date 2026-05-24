export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type AccountStatus = 'active' | 'passed' | 'failed'
export type SessionStatus = 'active' | 'completed'
export type TradingSession = 'LONDON' | 'NY_OPEN' | 'NY_CLOSE' | 'ASIA' | 'OTHER'
export type TradeDirection = 'long' | 'short'
export type TradeResult = 'win' | 'loss' | 'breakeven'
export type DrawdownType = 'trailing' | 'static'
export type CircuitBreakerThreshold = 50 | 80
export type CircuitBreakerAction = 'continued' | 'ended_session'

export interface Trader {
  id: string
  email: string
  timezone: string
  subscription_status: SubscriptionStatus
  trial_ends_at: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  tradovate_username: string | null
  tradovate_password: string | null
  updated_at: string
}

export interface PropFirmRule {
  id: string
  name: string
  dll_amount: number
  max_drawdown: number
  profit_target: number
  drawdown_type: DrawdownType
  min_trading_days: number
  reset_time: string
  reset_timezone: string
  is_custom: boolean
}

export interface PropAccount {
  id: string
  trader_id: string
  firm_id: string | null
  nickname: string
  starting_balance: number
  current_balance: number
  status: AccountStatus
  created_at: string
  prop_firm_rules?: PropFirmRule
}

export interface SetupType {
  id: string
  trader_id: string
  name: string
  created_at: string
}

export interface Session {
  id: string
  prop_account_id: string
  start_time: string
  end_time: string | null
  trading_session: TradingSession | null
  pre_emotional_state: string | null
  has_setup: boolean | null
  game_plan: string | null
  debrief_responses: DebriefResponses | null
  status: SessionStatus
  created_at: string
  prop_accounts?: PropAccount
}

export interface DebriefResponses {
  followed_rules: 'yes' | 'mostly' | 'no'
  emotional_rating: number
  notes: string
  will_trade_tomorrow: boolean
}

export interface Trade {
  id: string
  session_id: string
  instrument: string
  direction: TradeDirection
  entry_time: string
  result: TradeResult
  pnl: number
  setup_type_id: string | null
  confluence_count: number
  emotional_state: string | null
  contract_size: number
  trade_story: string | null
  created_at: string
  setup_types?: SetupType
}

export interface CircuitBreakerEvent {
  id: string
  session_id: string
  threshold_pct: CircuitBreakerThreshold
  triggered_at: string
  q1_response: string | null
  q2_response: string | null
  q3_response: string | null
  action_taken: CircuitBreakerAction | null
}

// Analytics types
export interface WinRateByDimension {
  dimension: string
  wins: number
  losses: number
  breakevens: number
  total: number
  win_rate: number
  avg_pnl: number
}

export interface EquityPoint {
  date: string
  cumulative_pnl: number
  session_pnl: number
}

export interface AnalyticsSummary {
  total_sessions: number
  total_trades: number
  total_pnl: number
  win_rate: number
  profit_factor: number
  avg_session_pnl: number
  circuit_breaker_cost: number
  rule_adherence_rate: number
  equity_curve: EquityPoint[]
  win_rate_by_setup: WinRateByDimension[]
  win_rate_by_session: WinRateByDimension[]
  win_rate_by_emotion: WinRateByDimension[]
  win_rate_by_confluence: WinRateByDimension[]
}

// P&L state for circuit breaker
export interface PnLState {
  sessionPnl: number
  dllAmount: number
  pctOfDll: number
}

export interface CircuitBreakerResult {
  shouldFire: boolean
  threshold: CircuitBreakerThreshold | null
}
