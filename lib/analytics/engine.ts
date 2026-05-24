import type {
  Trade,
  Session,
  SetupType,
  CircuitBreakerEvent,
  AnalyticsSummary,
  WinRateByDimension,
  EquityPoint,
  DayOfWeekStats,
  MistakeStat,
} from '@/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    acc[k] = acc[k] ?? []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

function winRateStats(trades: Trade[]): Omit<WinRateByDimension, 'dimension'> {
  const wins = trades.filter(t => t.result === 'win').length
  const losses = trades.filter(t => t.result === 'loss').length
  const breakevens = trades.filter(t => t.result === 'breakeven').length
  const total = trades.length
  const win_rate = total > 0 ? wins / total : 0
  const avg_pnl = total > 0 ? trades.reduce((s, t) => s + t.pnl, 0) / total : 0
  return { wins, losses, breakevens, total, win_rate, avg_pnl }
}

function profitFactor(trades: Trade[]): number {
  const gross_profit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const gross_loss = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  return gross_loss === 0 ? gross_profit > 0 ? Infinity : 1 : gross_profit / gross_loss
}

export function computeAnalytics(
  sessions: Session[],
  trades: Trade[],
  cbEvents: CircuitBreakerEvent[],
  setupTypes?: SetupType[]
): AnalyticsSummary {
  const total_sessions = sessions.length
  const total_trades = trades.length
  const total_pnl = trades.reduce((s, t) => s + t.pnl, 0)
  const { wins, win_rate } = winRateStats(trades)
  void wins

  const circuit_breaker_cost = cbEvents
    .filter(e => e.action_taken === 'ended_session')
    .reduce((sum, e) => {
      const sessionTrades = trades.filter(t => t.session_id === e.session_id)
      return sum + sessionTrades.reduce((s, t) => s + t.pnl, 0)
    }, 0)

  // Rule adherence
  const sessionsWithDebrief = sessions.filter(s => s.debrief_responses)
  const rule_adherence_rate =
    sessionsWithDebrief.length > 0
      ? sessionsWithDebrief.filter(
          s =>
            s.debrief_responses?.followed_rules === 'yes' ||
            s.debrief_responses?.followed_rules === 'mostly'
        ).length / sessionsWithDebrief.length
      : 0

  // Equity curve — one point per session
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )
  let running = 0
  const equity_curve: EquityPoint[] = sorted.map(s => {
    const sessionPnl = trades
      .filter(t => t.session_id === s.id)
      .reduce((sum, t) => sum + t.pnl, 0)
    running += sessionPnl
    return {
      date: s.start_time.split('T')[0],
      cumulative_pnl: running,
      session_pnl: sessionPnl,
    }
  })

  // Win rate by setup (use name if setupTypes provided, fallback to id)
  const setupNameMap: Record<string, string> = {}
  for (const st of setupTypes ?? []) setupNameMap[st.id] = st.name
  const bySetup = groupBy(
    trades.filter(t => t.setup_type_id),
    t => setupNameMap[t.setup_type_id!] ?? t.setup_type_id!
  )
  const win_rate_by_setup: WinRateByDimension[] = Object.entries(bySetup).map(
    ([dimension, ts]) => ({ dimension, ...winRateStats(ts) })
  )

  // Win rate by trading session
  const tradeToSession = Object.fromEntries(sessions.map(s => [s.id, s.trading_session]))
  const bySession = groupBy(
    trades.filter(t => tradeToSession[t.session_id]),
    t => tradeToSession[t.session_id]!
  )
  const win_rate_by_session: WinRateByDimension[] = Object.entries(bySession).map(
    ([dimension, ts]) => ({ dimension, ...winRateStats(ts) })
  )

  // Win rate by emotion
  const byEmotion = groupBy(trades.filter(t => t.emotional_state), t => t.emotional_state!)
  const win_rate_by_emotion: WinRateByDimension[] = Object.entries(byEmotion).map(
    ([dimension, ts]) => ({ dimension, ...winRateStats(ts) })
  )

  // Win rate by confluence count
  const byConfluence = groupBy(trades, t => String(t.confluence_count))
  const win_rate_by_confluence: WinRateByDimension[] = Object.entries(byConfluence).map(
    ([dimension, ts]) => ({ dimension, ...winRateStats(ts) })
  )

  // P&L by day of week (based on session start_time)
  const sessionPnlMap: Record<string, number> = {}
  for (const s of sessions) {
    sessionPnlMap[s.id] = trades
      .filter(t => t.session_id === s.id)
      .reduce((sum, t) => sum + t.pnl, 0)
  }
  const dayPnlMap: Record<string, number[]> = {}
  for (const s of sessions) {
    const day = DAYS[new Date(s.start_time).getDay()]
    dayPnlMap[day] = dayPnlMap[day] ?? []
    dayPnlMap[day].push(sessionPnlMap[s.id])
  }
  const pnl_by_day_of_week: DayOfWeekStats[] = DAYS
    .filter(day => dayPnlMap[day])
    .map(day => {
      const pnls = dayPnlMap[day]
      return {
        day,
        sessions: pnls.length,
        avg_pnl: pnls.reduce((a, b) => a + b, 0) / pnls.length,
        total_pnl: pnls.reduce((a, b) => a + b, 0),
        win_sessions: pnls.filter(p => p > 0).length,
      }
    })

  // Mistake tag analysis
  const mistakeMap: Record<string, { count: number; cost: number }> = {}
  for (const t of trades) {
    if (t.mistake_tags && t.mistake_tags.length > 0) {
      for (const tag of t.mistake_tags) {
        mistakeMap[tag] = mistakeMap[tag] ?? { count: 0, cost: 0 }
        mistakeMap[tag].count += 1
        mistakeMap[tag].cost += t.pnl
      }
    }
  }
  const mistake_stats: MistakeStat[] = Object.entries(mistakeMap).map(([tag, { count, cost }]) => ({
    tag,
    count,
    total_cost: cost,
    avg_cost: cost / count,
  })).sort((a, b) => a.total_cost - b.total_cost)

  const mistake_total_cost = trades
    .filter(t => t.mistake_tags && t.mistake_tags.length > 0)
    .reduce((sum, t) => sum + t.pnl, 0)

  return {
    total_sessions,
    total_trades,
    total_pnl,
    win_rate,
    profit_factor: profitFactor(trades),
    avg_session_pnl: total_sessions > 0 ? total_pnl / total_sessions : 0,
    circuit_breaker_cost,
    rule_adherence_rate,
    equity_curve,
    win_rate_by_setup,
    win_rate_by_session,
    win_rate_by_emotion,
    win_rate_by_confluence,
    pnl_by_day_of_week,
    mistake_stats,
    mistake_total_cost,
  }
}
