import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { computeAnalytics } from '@/lib/analytics/engine'
import type { AnalyticsSummary, WinRateByDimension, EquityPoint, DayOfWeekStats, MistakeStat } from '@/types'

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatPnl(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return (value < 0 ? '-' : '') + '$' + abs
}

function formatPct(value: number): string {
  return (value * 100).toFixed(1) + '%'
}

// ─── Metric Card (TradeZella-style) ──────────────────────────────────────────

function MetricCard({
  label,
  value,
  valueClass = 'text-white',
  icon,
  glowClass = 'bg-slate-500/10',
  iconBg = 'bg-slate-800',
}: {
  label: string
  value: string
  valueClass?: string
  icon?: React.ReactNode
  glowClass?: string
  iconBg?: string
}) {
  return (
    <div className="relative bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-4 overflow-hidden">
      <div className={`absolute -top-4 -right-4 w-16 h-16 ${glowClass} rounded-full blur-xl pointer-events-none`} />
      {icon && (
        <div className={`w-8 h-8 rounded-lg ${iconBg} border border-white/5 flex items-center justify-center mb-3`}>
          {icon}
        </div>
      )}
      <span className={`text-2xl font-bold font-mono tabular-nums ${valueClass}`}>
        {value}
      </span>
      <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide">{label}</p>
    </div>
  )
}

// ─── Equity Curve (SVG) ───────────────────────────────────────────────────────

function EquityCurve({ points }: { points: EquityPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-slate-500 text-sm py-12 text-center">
        No completed sessions yet
      </p>
    )
  }

  const W = 800
  const H = 192
  const PAD_X = 8
  const PAD_Y = 16

  const values = points.map(p => p.cumulative_pnl)
  const minVal = Math.min(0, ...values)
  const maxVal = Math.max(0, ...values)
  const range = maxVal - minVal || 1

  function xOf(i: number) {
    return PAD_X + ((W - PAD_X * 2) * i) / Math.max(points.length - 1, 1)
  }
  function yOf(v: number) {
    return PAD_Y + (H - PAD_Y * 2) * (1 - (v - minVal) / range)
  }

  const zeroY = yOf(0)

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(p.cumulative_pnl).toFixed(1)}`)
    .join(' ')

  const allXY = points.map((p, i) => ({
    x: xOf(i),
    y: yOf(p.cumulative_pnl),
    v: p.cumulative_pnl,
  }))

  const posArea =
    allXY.map(pt => `${pt.x.toFixed(1)},${Math.min(pt.y, zeroY).toFixed(1)}`).join(' ') +
    ` ${allXY[allXY.length - 1].x.toFixed(1)},${zeroY.toFixed(1)} ${allXY[0].x.toFixed(1)},${zeroY.toFixed(1)}`

  const negArea =
    allXY.map(pt => `${pt.x.toFixed(1)},${Math.max(pt.y, zeroY).toFixed(1)}`).join(' ') +
    ` ${allXY[allXY.length - 1].x.toFixed(1)},${zeroY.toFixed(1)} ${allXY[0].x.toFixed(1)},${zeroY.toFixed(1)}`

  const lastPoint = allXY[allXY.length - 1]
  const lastValue = points[points.length - 1].cumulative_pnl

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-48"
        aria-label="Equity curve chart"
      >
        <line
          x1={PAD_X}
          y1={zeroY}
          x2={W - PAD_X}
          y2={zeroY}
          stroke="#334155"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <polygon points={posArea} fill="rgba(34,197,94,0.10)" />
        <polygon points={negArea} fill="rgba(239,68,68,0.10)" />
        <path
          d={pathData}
          fill="none"
          stroke={lastValue >= 0 ? '#22c55e' : '#ef4444'}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {allXY.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="3"
            fill={pt.v >= 0 ? '#22c55e' : '#ef4444'}
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        ))}
        {points.length > 0 && (
          <text
            x={lastPoint.x}
            y={lastPoint.y - 8}
            textAnchor="middle"
            fontSize="10"
            fill={lastValue >= 0 ? '#86efac' : '#fca5a5'}
            fontFamily="monospace"
          >
            {formatPnl(lastValue)}
          </text>
        )}
      </svg>

      {points.length > 1 && (
        <div className="flex justify-between text-xs text-slate-500 font-mono mt-1 px-2">
          <span>{points[0].date}</span>
          {points.length > 2 && (
            <span>{points[Math.floor(points.length / 2)].date}</span>
          )}
          <span>{points[points.length - 1].date}</span>
        </div>
      )}
    </div>
  )
}

// ─── Win Rate Table ───────────────────────────────────────────────────────────

function winRateColor(rate: number): string {
  if (rate >= 0.6) return 'text-emerald-400'
  if (rate >= 0.4) return 'text-amber-400'
  return 'text-red-400'
}

function WinRateTable({
  rows,
  emptyMessage = 'No data yet',
  showPlaybookCols = false,
}: {
  rows: WinRateByDimension[]
  emptyMessage?: string
  showPlaybookCols?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-slate-500 text-sm py-6 text-center">{emptyMessage}</p>
  }

  const sorted = [...rows].sort((a, b) => b.win_rate - a.win_rate)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-left border-b border-slate-800">
            <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide">Name</th>
            <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide tabular-nums text-right">Trades</th>
            <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-right">Win Rate</th>
            <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-right">Avg P&amp;L</th>
            {showPlaybookCols && (
              <>
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-right">Prof. Factor</th>
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-right">Expectancy</th>
              </>
            )}
            <th className="pb-2 text-xs font-semibold uppercase tracking-wide">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const pfDisplay = row.profit_factor === Infinity ? '∞' : isFinite(row.profit_factor) ? row.profit_factor.toFixed(2) + 'x' : '—'
            return (
              <tr
                key={row.dimension}
                className="border-b border-slate-800/50 last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="py-2.5 pr-4 text-slate-200 font-medium capitalize">
                  {row.dimension}
                </td>
                <td className="py-2.5 pr-4 text-slate-400 font-mono tabular-nums text-right">
                  {row.total}
                </td>
                <td className={`py-2.5 pr-4 font-mono tabular-nums font-semibold text-right ${winRateColor(row.win_rate)}`}>
                  {formatPct(row.win_rate)}
                </td>
                <td className={`py-2.5 pr-4 font-mono tabular-nums text-right ${row.avg_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPnl(row.avg_pnl)}
                </td>
                {showPlaybookCols && (
                  <>
                    <td className={`py-2.5 pr-4 font-mono tabular-nums text-right ${row.profit_factor >= 1.5 ? 'text-emerald-400' : row.profit_factor >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                      {pfDisplay}
                    </td>
                    <td className={`py-2.5 pr-4 font-mono tabular-nums text-right ${row.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPnl(row.expectancy)}
                    </td>
                  </>
                )}
                <td className="py-2.5">
                  <div className="w-28 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.win_rate >= 0.6
                          ? 'bg-emerald-500'
                          : row.win_rate >= 0.4
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.round(row.win_rate * 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Best/Worst Day Chart ─────────────────────────────────────────────────────

function DayOfWeekChart({ rows }: { rows: DayOfWeekStats[] }) {
  if (rows.length === 0) {
    return <p className="text-slate-500 text-sm py-6 text-center">No session data yet</p>
  }

  const sorted = [...rows].sort((a, b) => b.avg_pnl - a.avg_pnl)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.avg_pnl)), 1)

  return (
    <div className="space-y-4">
      {/* Best/Worst callouts */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-emerald-400/70 uppercase tracking-wide font-semibold mb-0.5">Best Day</p>
          <p className="text-white font-semibold">{best.day}</p>
          <p className="text-emerald-400 font-mono text-sm font-semibold">{formatPnl(best.avg_pnl)} avg</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-red-400/70 uppercase tracking-wide font-semibold mb-0.5">Worst Day</p>
          <p className="text-white font-semibold">{worst.day}</p>
          <p className="text-red-400 font-mono text-sm font-semibold">{formatPnl(worst.avg_pnl)} avg</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="space-y-2.5">
        {sorted.map(row => {
          const pct = Math.round((Math.abs(row.avg_pnl) / maxAbs) * 100)
          const positive = row.avg_pnl >= 0
          return (
            <div key={row.day} className="flex items-center gap-3">
              <span className="w-24 text-sm text-slate-400 flex-shrink-0">{row.day}</span>
              <div className="flex-1 h-7 bg-slate-800/80 rounded-lg overflow-hidden flex items-center">
                <div
                  className={`h-full rounded-lg transition-all ${positive ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`w-20 text-sm font-mono font-semibold text-right flex-shrink-0 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPnl(row.avg_pnl)}
              </span>
              <span className="w-14 text-xs text-slate-600 font-mono text-right flex-shrink-0">
                {row.sessions}s
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-600 pt-1">Avg P&L per session by day of week. Consider avoiding your worst days.</p>
    </div>
  )
}

// ─── Mistake Cost Table ───────────────────────────────────────────────────────

function MistakeTable({ rows, totalCost }: { rows: MistakeStat[]; totalCost: number }) {
  if (rows.length === 0) {
    return (
      <p className="text-slate-500 text-sm py-6 text-center">
        No mistakes tagged yet. Tag mistakes in the trade form to track their cost.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {totalCost < 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-red-400/70 uppercase tracking-wide font-semibold">Total Mistake Cost</p>
            <p className="text-red-400 font-mono text-xl font-bold mt-0.5">{formatPnl(totalCost)}</p>
          </div>
          <p className="text-slate-400 text-xs max-w-[200px] text-right">
            This is how much money your tagged mistakes have cost you
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-left border-b border-slate-800">
              <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide">Mistake</th>
              <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-right">Count</th>
              <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-right">Total Cost</th>
              <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-right">Avg Cost/Trade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.tag} className="border-b border-slate-800/50 last:border-0 hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 pr-4 text-slate-200 font-medium">{row.tag}</td>
                <td className="py-2.5 pr-4 text-slate-400 font-mono tabular-nums text-right">{row.count}</td>
                <td className={`py-2.5 pr-4 font-mono tabular-nums font-semibold text-right ${row.total_cost >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPnl(row.total_cost)}
                </td>
                <td className={`py-2.5 font-mono tabular-nums text-right ${row.avg_cost >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPnl(row.avg_cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Confluence Bar Chart ─────────────────────────────────────────────────────

function ConfluenceChart({ rows }: { rows: WinRateByDimension[] }) {
  if (rows.length === 0) {
    return <p className="text-slate-500 text-sm py-6 text-center">No trade data yet</p>
  }

  const sorted = [...rows].sort((a, b) => Number(a.dimension) - Number(b.dimension))
  const maxRate = Math.max(...sorted.map(r => r.win_rate), 0.01)

  return (
    <div className="space-y-3">
      {sorted.map((row) => {
        const label =
          Number(row.dimension) >= 5
            ? `${row.dimension}+ confluences`
            : `${row.dimension} confluence${row.dimension === '1' ? '' : 's'}`
        return (
          <div key={row.dimension} className="flex items-center gap-3">
            <span className="w-28 text-sm text-slate-400 flex-shrink-0">{label}</span>
            <div className="flex-1 h-7 bg-slate-800 rounded-lg overflow-hidden">
              <div
                className={`h-full rounded-lg transition-all ${
                  row.win_rate >= 0.6
                    ? 'bg-emerald-500'
                    : row.win_rate >= 0.4
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.round((row.win_rate / maxRate) * 100)}%` }}
              />
            </div>
            <span className={`w-14 text-sm font-mono tabular-nums font-semibold text-right flex-shrink-0 ${winRateColor(row.win_rate)}`}>
              {formatPct(row.win_rate)}
            </span>
            <span className="w-16 text-xs text-slate-500 font-mono tabular-nums text-right flex-shrink-0">
              {row.total} trade{row.total !== 1 ? 's' : ''}
            </span>
          </div>
        )
      })}
      <p className="text-xs text-slate-600 pt-1">
        Bar width scaled to highest win rate. More confluences = higher win rate?
      </p>
    </div>
  )
}

// ─── Circuit Breaker Summary ──────────────────────────────────────────────────

function CircuitBreakerSummary({
  analytics,
  cbEvents,
}: {
  analytics: AnalyticsSummary
  cbEvents: { threshold_pct: number; action_taken: string | null }[]
}) {
  const triggers50 = cbEvents.filter(e => e.threshold_pct === 50).length
  const triggers80 = cbEvents.filter(e => e.threshold_pct === 80).length
  const endedSessions = cbEvents.filter(
    e => e.threshold_pct === 80 && e.action_taken === 'ended_session'
  ).length
  const cost = analytics.circuit_breaker_cost

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">
            {triggers50}
          </p>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide">50% CB triggers</p>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <p className="text-2xl font-bold font-mono tabular-nums text-red-400">
            {triggers80}
          </p>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide">80% CB triggers</p>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <p className="text-2xl font-bold font-mono tabular-nums text-red-400">
            {endedSessions}
          </p>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide">Sessions force-ended</p>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <p className={`text-2xl font-bold font-mono tabular-nums ${cost <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatPnl(cost)}
          </p>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide">Lockout P&amp;L</p>
        </div>
      </div>

      {triggers80 > 0 && cost < 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-slate-300">
          <span className="text-amber-400 font-semibold">Note: </span>
          The 80% circuit breaker ended {endedSessions} session
          {endedSessions !== 1 ? 's' : ''} that were already in a drawdown of{' '}
          <span className="text-red-400 font-mono">{formatPnl(cost)}</span>. Without
          the lockout, losses could have extended further.
        </div>
      )}

      {cbEvents.length === 0 && (
        <p className="text-slate-500 text-sm py-4 text-center">
          No circuit breaker events recorded yet. Great discipline!
        </p>
      )}
    </div>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  subtitle,
}: {
  title: string
  children: React.ReactNode
  subtitle?: string
}) {
  return (
    <section className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" strokeWidth="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-white">No completed sessions yet</h2>
      <p className="text-slate-400 text-sm max-w-xs">
        Complete your first trading session to start seeing analytics, equity curves,
        and win rate breakdowns.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium transition-colors shadow-lg shadow-teal-500/20"
      >
        Start your first session
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accounts } = await supabase
    .from('prop_accounts')
    .select('id')
    .eq('trader_id', user.id)
  const accountIds = accounts?.map((a) => a.id) ?? []

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .in('prop_account_id', accountIds.length > 0 ? accountIds : ['__none__'])
    .eq('status', 'completed')
    .order('start_time')
  const sessionIds = sessions?.map((s) => s.id) ?? []

  const [{ data: trades }, { data: cbEventsRaw }, { data: setupTypes }] = await Promise.all([
    supabase
      .from('trades')
      .select('*')
      .in('session_id', sessionIds.length > 0 ? sessionIds : ['__none__']),
    supabase
      .from('circuit_breaker_events')
      .select('*')
      .in('session_id', sessionIds.length > 0 ? sessionIds : ['__none__']),
    supabase
      .from('setup_types')
      .select('*')
      .eq('trader_id', user.id),
  ])

  const cbEvents = cbEventsRaw ?? []
  const analytics = computeAnalytics(sessions ?? [], trades ?? [], cbEvents, setupTypes ?? [])

  if (analytics.total_sessions === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <EmptyState />
      </div>
    )
  }

  const pnlClass = analytics.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
  const pfDisplay =
    analytics.profit_factor === Infinity
      ? '∞'
      : isFinite(analytics.profit_factor)
      ? analytics.profit_factor.toFixed(2) + 'x'
      : '—'

  const debriefSessions = (sessions ?? []).filter((s) => s.debrief_responses)
  const adherentSessions = debriefSessions.filter(
    (s) =>
      s.debrief_responses?.followed_rules === 'yes' ||
      s.debrief_responses?.followed_rules === 'mostly'
  )
  const adherenceDisplay =
    debriefSessions.length > 0
      ? `${adherentSessions.length}/${debriefSessions.length}`
      : '—'

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Performance overview across all completed sessions
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Total Sessions"
          value={String(analytics.total_sessions)}
          glowClass="bg-teal-500/15"
          iconBg="bg-teal-500/15"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <MetricCard
          label="Total Trades"
          value={String(analytics.total_trades)}
          glowClass="bg-slate-500/10"
          iconBg="bg-slate-700/60"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
        <MetricCard
          label="Total P&L"
          value={formatPnl(analytics.total_pnl)}
          valueClass={pnlClass}
          glowClass={analytics.total_pnl >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}
          iconBg={analytics.total_pnl >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={analytics.total_pnl >= 0 ? '#34d399' : '#f87171'} strokeWidth="2" strokeLinecap="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            </svg>
          }
        />
        <MetricCard
          label="Win Rate"
          value={formatPct(analytics.win_rate)}
          valueClass={
            analytics.win_rate >= 0.6
              ? 'text-emerald-400'
              : analytics.win_rate >= 0.4
              ? 'text-amber-400'
              : 'text-red-400'
          }
          glowClass="bg-violet-500/15"
          iconBg="bg-violet-500/15"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          }
        />
        <MetricCard
          label="Profit Factor"
          value={pfDisplay}
          valueClass={
            analytics.profit_factor >= 1.5
              ? 'text-emerald-400'
              : analytics.profit_factor >= 1
              ? 'text-amber-400'
              : 'text-red-400'
          }
          glowClass="bg-amber-500/15"
          iconBg="bg-amber-500/15"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        />
        <MetricCard
          label="Avg Session P&L"
          value={formatPnl(analytics.avg_session_pnl)}
          valueClass={analytics.avg_session_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
          glowClass={analytics.avg_session_pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          iconBg="bg-slate-700/60"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
        />
        <MetricCard
          label="CB Cost"
          value={formatPnl(analytics.circuit_breaker_cost)}
          valueClass="text-red-400"
          glowClass="bg-red-500/10"
          iconBg="bg-red-500/15"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
        />
        <MetricCard
          label="Rule Adherence"
          value={adherenceDisplay}
          valueClass={
            adherentSessions.length === debriefSessions.length && debriefSessions.length > 0
              ? 'text-emerald-400'
              : 'text-amber-400'
          }
          glowClass="bg-teal-500/10"
          iconBg="bg-teal-500/15"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />
      </div>

      <Section title="Equity Curve" subtitle="Cumulative P&L across all sessions">
        <EquityCurve points={analytics.equity_curve} />
      </Section>

      <Section title="Best & Worst Days" subtitle="Which days of the week are most profitable for you">
        <DayOfWeekChart rows={analytics.pnl_by_day_of_week} />
      </Section>

      <Section title="Playbook Performance" subtitle="Win rate, profit factor, and expectancy per setup — your edge quantified">
        <WinRateTable
          rows={analytics.win_rate_by_setup}
          emptyMessage="No trades with setup types recorded yet — add setups in Settings"
          showPlaybookCols
        />
      </Section>

      <Section title="Performance by Session" subtitle="London, NY Open, NY Close, Asia">
        <WinRateTable
          rows={analytics.win_rate_by_session}
          emptyMessage="No trading session data yet"
        />
      </Section>

      <Section title="Emotional State Performance" subtitle="How your mental state correlates with results">
        <WinRateTable
          rows={analytics.win_rate_by_emotion}
          emptyMessage="No emotional state data yet"
        />
      </Section>

      <Section title="Confluence Count vs Win Rate" subtitle="More confluences = better edge?">
        <ConfluenceChart rows={analytics.win_rate_by_confluence} />
      </Section>

      <Section title="Mistake Cost Analysis" subtitle="How much your tagged mistakes have cost you">
        <MistakeTable rows={analytics.mistake_stats} totalCost={analytics.mistake_total_cost} />
      </Section>

      <Section title="Circuit Breaker Summary" subtitle="Discipline events across all sessions">
        <CircuitBreakerSummary analytics={analytics} cbEvents={cbEvents} />
      </Section>
    </div>
  )
}
