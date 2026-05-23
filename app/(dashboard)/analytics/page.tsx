import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { computeAnalytics } from '@/lib/analytics/engine'
import type { AnalyticsSummary, WinRateByDimension, EquityPoint } from '@/types'

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

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-zinc-800 rounded-xl p-4 flex flex-col gap-1">
      <span className={`text-2xl font-bold font-mono tabular-nums ${valueClass}`}>
        {value}
      </span>
      <span className="text-zinc-400 text-sm">{label}</span>
    </div>
  )
}

// ─── Equity Curve (SVG) ───────────────────────────────────────────────────────

function EquityCurve({ points }: { points: EquityPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-zinc-500 text-sm py-12 text-center">
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

  // Green / Red split: two separate poly areas
  const greenPoints: string[] = []
  const redPoints: string[] = []

  // Build a clip-path approach using polygon for above/below zero
  const allXY = points.map((p, i) => ({
    x: xOf(i),
    y: yOf(p.cumulative_pnl),
    v: p.cumulative_pnl,
  }))

  // Area polygon for positive (clamped at zero line)
  const posArea =
    allXY.map(pt => `${pt.x.toFixed(1)},${Math.min(pt.y, zeroY).toFixed(1)}`).join(' ') +
    ` ${allXY[allXY.length - 1].x.toFixed(1)},${zeroY.toFixed(1)} ${allXY[0].x.toFixed(1)},${zeroY.toFixed(1)}`

  // Area polygon for negative (clamped at zero line)
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
        {/* Zero line */}
        <line
          x1={PAD_X}
          y1={zeroY}
          x2={W - PAD_X}
          y2={zeroY}
          stroke="#52525b"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Positive fill area */}
        <polygon points={posArea} fill="rgba(34,197,94,0.12)" />

        {/* Negative fill area */}
        <polygon points={negArea} fill="rgba(239,68,68,0.12)" />

        {/* Main line — colored by last value */}
        <path
          d={pathData}
          fill="none"
          stroke={lastValue >= 0 ? '#22c55e' : '#ef4444'}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots for each point */}
        {allXY.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="3"
            fill={pt.v >= 0 ? '#22c55e' : '#ef4444'}
            stroke="#18181b"
            strokeWidth="1.5"
          />
        ))}

        {/* Label for last point */}
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

      {/* X-axis date labels */}
      {points.length > 1 && (
        <div className="flex justify-between text-xs text-zinc-500 font-mono mt-1 px-2">
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
  if (rate >= 0.6) return 'text-green-400'
  if (rate >= 0.4) return 'text-amber-400'
  return 'text-red-400'
}

function WinRateTable({
  rows,
  emptyMessage = 'No data yet',
}: {
  rows: WinRateByDimension[]
  emptyMessage?: string
}) {
  if (rows.length === 0) {
    return <p className="text-zinc-500 text-sm py-6 text-center">{emptyMessage}</p>
  }

  const sorted = [...rows].sort((a, b) => b.win_rate - a.win_rate)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-400 text-left border-b border-zinc-700">
            <th className="pb-2 pr-4 font-medium">Name</th>
            <th className="pb-2 pr-4 font-medium tabular-nums text-right">Trades</th>
            <th className="pb-2 pr-4 font-medium text-right">Win Rate</th>
            <th className="pb-2 pr-4 font-medium text-right">Avg P&amp;L</th>
            <th className="pb-2 font-medium">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.dimension}
              className="border-b border-zinc-700 last:border-0 hover:bg-zinc-700/50 transition-colors"
            >
              <td className="py-2.5 pr-4 text-zinc-200 font-medium capitalize">
                {row.dimension}
              </td>
              <td className="py-2.5 pr-4 text-zinc-300 font-mono tabular-nums text-right">
                {row.total}
              </td>
              <td className={`py-2.5 pr-4 font-mono tabular-nums font-semibold text-right ${winRateColor(row.win_rate)}`}>
                {formatPct(row.win_rate)}
              </td>
              <td className={`py-2.5 pr-4 font-mono tabular-nums text-right ${row.avg_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPnl(row.avg_pnl)}
              </td>
              <td className="py-2.5">
                <div className="w-28 h-2 rounded-full bg-zinc-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      row.win_rate >= 0.6
                        ? 'bg-green-500'
                        : row.win_rate >= 0.4
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.round(row.win_rate * 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Confluence Bar Chart ─────────────────────────────────────────────────────

function ConfluenceChart({ rows }: { rows: WinRateByDimension[] }) {
  if (rows.length === 0) {
    return <p className="text-zinc-500 text-sm py-6 text-center">No trade data yet</p>
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
            <span className="w-28 text-sm text-zinc-400 flex-shrink-0">{label}</span>
            <div className="flex-1 h-7 bg-zinc-700 rounded-lg overflow-hidden">
              <div
                className={`h-full rounded-lg transition-all ${
                  row.win_rate >= 0.6
                    ? 'bg-green-500'
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
            <span className="w-16 text-xs text-zinc-500 font-mono tabular-nums text-right flex-shrink-0">
              {row.total} trade{row.total !== 1 ? 's' : ''}
            </span>
          </div>
        )
      })}
      <p className="text-xs text-zinc-500 pt-1">
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
        <div className="bg-zinc-700/50 rounded-xl p-4">
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">
            {triggers50}
          </p>
          <p className="text-zinc-400 text-sm mt-1">50% CB triggers</p>
        </div>
        <div className="bg-zinc-700/50 rounded-xl p-4">
          <p className="text-2xl font-bold font-mono tabular-nums text-red-400">
            {triggers80}
          </p>
          <p className="text-zinc-400 text-sm mt-1">80% CB triggers</p>
        </div>
        <div className="bg-zinc-700/50 rounded-xl p-4">
          <p className="text-2xl font-bold font-mono tabular-nums text-red-400">
            {endedSessions}
          </p>
          <p className="text-zinc-400 text-sm mt-1">Sessions force-ended</p>
        </div>
        <div className="bg-zinc-700/50 rounded-xl p-4">
          <p className={`text-2xl font-bold font-mono tabular-nums ${cost <= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatPnl(cost)}
          </p>
          <p className="text-zinc-400 text-sm mt-1">Lockout session P&amp;L</p>
        </div>
      </div>

      {triggers80 > 0 && cost < 0 && (
        <div className="bg-zinc-700/30 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-300">
          <span className="text-amber-400 font-semibold">Note: </span>
          The 80% circuit breaker ended {endedSessions} session
          {endedSessions !== 1 ? 's' : ''} that were already in a drawdown of{' '}
          <span className="text-red-400 font-mono">{formatPnl(cost)}</span>. Without
          the lockout, losses could have extended further — the CB protected your account
          from deeper drawdown.
        </div>
      )}

      {cbEvents.length === 0 && (
        <p className="text-zinc-500 text-sm py-4 text-center">
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
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-zinc-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      {children}
    </section>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center gap-4">
      <div className="text-5xl">📊</div>
      <h2 className="text-xl font-semibold text-white">No completed sessions yet</h2>
      <p className="text-zinc-400 text-sm max-w-xs">
        Complete your first trading session to start seeing analytics, equity curves,
        and win rate breakdowns.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors"
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

  // Fetch all required data
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

  const [{ data: trades }, { data: cbEventsRaw }] = await Promise.all([
    supabase
      .from('trades')
      .select('*')
      .in('session_id', sessionIds.length > 0 ? sessionIds : ['__none__']),
    supabase
      .from('circuit_breaker_events')
      .select('*')
      .in('session_id', sessionIds.length > 0 ? sessionIds : ['__none__']),
  ])

  const cbEvents = cbEventsRaw ?? []
  const analytics = computeAnalytics(sessions ?? [], trades ?? [], cbEvents)

  // Empty state
  if (analytics.total_sessions === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <EmptyState />
      </div>
    )
  }

  // Summaries
  const pnlClass = analytics.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
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
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Performance overview across all completed sessions
        </p>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Total Sessions"
          value={String(analytics.total_sessions)}
        />
        <MetricCard
          label="Total Trades"
          value={String(analytics.total_trades)}
        />
        <MetricCard
          label="Total P&L"
          value={formatPnl(analytics.total_pnl)}
          valueClass={pnlClass}
        />
        <MetricCard
          label="Win Rate"
          value={formatPct(analytics.win_rate)}
          valueClass={
            analytics.win_rate >= 0.6
              ? 'text-green-400'
              : analytics.win_rate >= 0.4
              ? 'text-amber-400'
              : 'text-red-400'
          }
        />
        <MetricCard
          label="Profit Factor"
          value={pfDisplay}
          valueClass={
            analytics.profit_factor >= 1.5
              ? 'text-green-400'
              : analytics.profit_factor >= 1
              ? 'text-amber-400'
              : 'text-red-400'
          }
        />
        <MetricCard
          label="Avg Session P&L"
          value={formatPnl(analytics.avg_session_pnl)}
          valueClass={analytics.avg_session_pnl >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <MetricCard
          label="Circuit Breaker Cost"
          value={formatPnl(analytics.circuit_breaker_cost)}
          valueClass="text-red-400"
        />
        <MetricCard
          label="Rule Adherence"
          value={adherenceDisplay}
          valueClass={
            adherentSessions.length === debriefSessions.length && debriefSessions.length > 0
              ? 'text-green-400'
              : 'text-amber-400'
          }
        />
      </div>

      {/* ── Equity Curve ── */}
      <Section title="Equity Curve">
        <EquityCurve points={analytics.equity_curve} />
      </Section>

      {/* ── Win Rate by Setup ── */}
      <Section title="Win Rate by Setup Type">
        <WinRateTable
          rows={analytics.win_rate_by_setup}
          emptyMessage="No trades with setup types recorded yet"
        />
      </Section>

      {/* ── Win Rate by Trading Session ── */}
      <Section title="Win Rate by Trading Session">
        <WinRateTable
          rows={analytics.win_rate_by_session}
          emptyMessage="No trading session data yet"
        />
      </Section>

      {/* ── Win Rate by Emotional State ── */}
      <Section title="Win Rate by Emotional State">
        <WinRateTable
          rows={analytics.win_rate_by_emotion}
          emptyMessage="No emotional state data yet"
        />
      </Section>

      {/* ── Win Rate by Confluence ── */}
      <Section title="Win Rate by Confluence Count">
        <ConfluenceChart rows={analytics.win_rate_by_confluence} />
      </Section>

      {/* ── Circuit Breaker ── */}
      <Section title="Circuit Breaker Summary">
        <CircuitBreakerSummary analytics={analytics} cbEvents={cbEvents} />
      </Section>
    </div>
  )
}
