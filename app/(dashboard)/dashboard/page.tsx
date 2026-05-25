import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { PropAccount, PropFirmRule, Session, Trade } from '@/types'
import AddAccountButton from './AddAccountButton'
import DashboardCharts from './DashboardCharts'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatPnl(v: number) {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}

function scoreColor(s: number) {
  if (s >= 80) return '#22c55e'
  if (s >= 50) return '#f59e0b'
  return '#ef4444'
}

function emotionFromState(state: string | null): number {
  switch (state) {
    case 'Focused':    return 9
    case 'Calm':       return 8
    case 'Euphoric':   return 6
    case 'Anxious':    return 5
    case 'Frustrated': return 4
    default:           return 7
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: accounts } = await supabase
    .from('prop_accounts')
    .select('*, prop_firm_rules(*)')
    .eq('trader_id', user.id)
    .order('created_at')

  const accountIds = (accounts ?? []).map((a: PropAccount) => a.id)

  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('*, prop_accounts(nickname, prop_firm_rules(name))')
    .in('prop_account_id', accountIds.length ? accountIds : ['__none__'])
    .order('start_time', { ascending: false })
    .limit(6)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const sessionIds = (recentSessions ?? []).map((s: Session) => s.id)

  const { data: weekTrades } = await supabase
    .from('trades')
    .select('pnl, session_id, result, created_at')
    .in('session_id', sessionIds.length ? sessionIds : ['__none__'])
    .gte('created_at', weekAgo.toISOString())

  const { data: firmRules } = await supabase
    .from('prop_firm_rules')
    .select('*')
    .eq('is_custom', false)
    .order('name')

  const { data: allCompleted } = await supabase
    .from('sessions')
    .select('has_setup, debrief_responses, start_time, status, pre_emotional_state')
    .in('prop_account_id', accountIds.length ? accountIds : ['__none__'])
    .eq('status', 'completed')
    .order('start_time', { ascending: false })
    .limit(20)

  const completed   = allCompleted ?? []
  const total       = completed.length
  const hasSetupRate = total > 0 ? completed.filter(s => s.has_setup).length / total : 0
  const withDebrief  = completed.filter(s => s.debrief_responses)
  const adherenceRate = withDebrief.length > 0
    ? withDebrief.filter(s => ['yes', 'mostly'].includes(s.debrief_responses?.followed_rules ?? '')).length / withDebrief.length
    : 0
  const debriefRate = total > 0 ? withDebrief.length / total : 0

  const trades      = (weekTrades ?? []) as (Trade & { created_at: string })[]
  const weekPnl     = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const weekWins    = trades.filter(t => t.result === 'win').length
  const winRate     = trades.length > 0 ? Math.round((weekWins / trades.length) * 100) : null
  const weekWinRate = trades.length > 0 ? weekWins / trades.length : 0
  const propScore   = total === 0 ? null : Math.round(
    weekWinRate * 25 + adherenceRate * 30 + debriefRate * 25 + hasSetupRate * 20
  )

  // Streak (consecutive sessions with yes/mostly rule adherence)
  let streak = 0
  for (const s of completed) {
    const r = s.debrief_responses?.followed_rules
    if (r === 'yes' || r === 'mostly') streak++
    else break
  }

  // Consecutive losses from week trades
  let consecutiveLosses = 0
  for (const t of [...trades].reverse()) {
    if (t.result === 'win') break
    consecutiveLosses++
  }

  // DLL for first active account
  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0)
  const firstActive = (accounts as PropAccount[] ?? []).find(a => a.status === 'active')
  const firstRules  = firstActive?.prop_firm_rules as PropFirmRule | undefined
  const dllAmount   = firstRules?.dll_amount ?? 0
  const todaySessIds = (recentSessions ?? [])
    .filter(s => s.prop_account_id === firstActive?.id && new Date(s.start_time) >= todayStart)
    .map(s => s.id)
  const todayPnl  = trades.filter(t => todaySessIds.includes(t.session_id)).reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const dllPct    = dllAmount > 0 ? Math.min(100, Math.round((Math.abs(Math.min(0, todayPnl)) / dllAmount) * 100)) : 0

  const cbStatus = [
    { name: 'Daily Loss',       val: dllAmount > 0 ? `$${Math.abs(Math.min(0, todayPnl)).toFixed(0)} / $${dllAmount}` : '— / —', pct: dllPct, col: dllPct >= 80 ? '#ef4444' : dllPct >= 50 ? '#f59e0b' : '#22c55e' },
    { name: 'Drawdown',         val: '0.0% / 3.0%', pct: 0, col: '#22c55e' },
    { name: 'Consec. Losses',   val: `${consecutiveLosses} / 3`, pct: Math.min(100, Math.round((consecutiveLosses / 3) * 100)), col: consecutiveLosses >= 3 ? '#ef4444' : consecutiveLosses >= 2 ? '#f59e0b' : '#22c55e' },
  ]

  // Charts data
  const scoreData = withDebrief.slice(0, 6).reverse().map(s => ({
    date: new Date(s.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: Math.max(0, Math.round(
      (s.debrief_responses?.followed_rules === 'yes' ? 100 : s.debrief_responses?.followed_rules === 'mostly' ? 80 : 55)
      * ((s.debrief_responses?.emotional_rating ?? 7) / 10)
    )),
  }))

  // Equity curve: cumulative P&L from completed sessions (placeholder uses session order)
  const equityData = completed.length > 0
    ? completed.slice().reverse().map((s, i) => ({
        day: new Date(s.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pnl: Math.round(weekPnl * ((i + 1) / completed.length)), // approximation until full trade history loaded
      }))
    : [{ day: 'Start', pnl: 0 }]

  const sessions = (recentSessions ?? []) as Session[]

  const avgScore = scoreData.length > 0
    ? Math.round(scoreData.reduce((s, d) => s + d.score, 0) / scoreData.length)
    : null

  return (
    <div className="max-w-5xl mx-auto" style={{ color: '#f1f5f9' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>
            {greeting()},{' '}
            <span style={{ color: '#06b6d4' }}>{user.email?.split('@')[0]}</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <AddAccountButton firmOptions={(firmRules ?? []) as PropFirmRule[]} userId={user.id} />
      </div>

      {/* CB Status */}
      <div className="mb-6">
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#64748b', marginBottom: 10 }}>
          Live Circuit Breaker Status
        </p>
        <div className="grid grid-cols-3 gap-3">
          {cbStatus.map(cb => (
            <div key={cb.name} className="bg-[#14141e] border border-[#1e1e2e] rounded-xl px-4 py-3.5">
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontSize: 11, color: '#64748b' }}>{cb.name}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: cb.col, boxShadow: `0 0 8px ${cb.col}` }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', marginBottom: 8 }}>{cb.val}</div>
              <div style={{ height: 3, borderRadius: 2, background: '#1e1e2e' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${cb.pct}%`, background: cb.col, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Session Streak', val: String(streak), sub: 'no rule breaks',         col: '#22c55e', glow: '#22c55e33' },
          { label: 'Avg Score',      val: avgScore !== null ? String(avgScore) : '—', sub: 'last sessions',  col: '#f59e0b', glow: '#f59e0b33' },
          { label: 'Win Rate',       val: winRate !== null ? `${winRate}%` : '—', sub: 'this week', col: winRate === null || winRate >= 50 ? '#22c55e' : '#ef4444', glow: winRate === null || winRate >= 50 ? '#22c55e33' : '#ef444433' },
          { label: 'PropScore',      val: propScore !== null ? String(propScore) : '—', sub: propScore !== null ? (propScore >= 70 ? 'Disciplined' : propScore >= 45 ? 'Developing' : 'Needs work') : 'Complete sessions', col: propScore === null ? '#64748b' : scoreColor(propScore), glow: propScore === null ? '#64748b22' : `${scoreColor(propScore)}33` },
        ].map(m => (
          <div key={m.label} className="relative bg-[#14141e] border border-[#1e1e2e] rounded-xl p-5 overflow-hidden">
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: m.glow }} />
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>{m.label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, fontFamily: 'monospace', color: m.col, marginBottom: 3 }}>{m.val}</p>
            <p style={{ fontSize: 11, color: '#64748b' }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mb-6">
        <DashboardCharts equityData={equityData} scoreData={scoreData.length ? scoreData : [{ date: 'No data', score: 0 }]} />
      </div>

      {/* Accounts */}
      {(accounts ?? []).length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#64748b' }}>Accounts</p>
            <Link href="/accounts" style={{ fontSize: 12, color: '#06b6d4' }}>View all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(accounts as PropAccount[]).map(account => {
              const rules     = account.prop_firm_rules as PropFirmRule | undefined
              const dllAmt    = rules?.dll_amount ?? 0
              const acctSessIds = (recentSessions ?? [])
                .filter(s => s.prop_account_id === account.id && new Date(s.start_time) >= todayStart)
                .map(s => s.id)
              const acctTodayPnl = trades.filter(t => acctSessIds.includes(t.session_id)).reduce((sum, t) => sum + (t.pnl ?? 0), 0)
              const acctDllPct   = dllAmt > 0 ? Math.min(100, Math.round((Math.abs(Math.min(0, acctTodayPnl)) / dllAmt) * 100)) : 0
              const statusCol    = account.status === 'active' ? '#06b6d4' : account.status === 'passed' ? '#22c55e' : '#ef4444'
              const dllBarCol    = acctDllPct >= 80 ? '#ef4444' : acctDllPct >= 50 ? '#f59e0b' : '#22c55e'

              return (
                <div key={account.id} className="relative bg-[#14141e] border rounded-xl p-5 overflow-hidden" style={{ borderColor: `${statusCol}40` }}>
                  <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full blur-2xl pointer-events-none" style={{ background: `${statusCol}15` }} />
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 15 }}>{account.nickname}</p>
                      <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{rules?.name ?? 'Custom'}</p>
                    </div>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${statusCol}18`, color: statusCol, border: `1px solid ${statusCol}35` }}>
                      {account.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: 'Balance', val: account.starting_balance.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), col: undefined },
                      { label: 'Today P&L', val: formatPnl(acctTodayPnl), col: acctTodayPnl >= 0 ? '#22c55e' : '#ef4444' },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{stat.label}</p>
                        <p style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: stat.col }}>{stat.val}</p>
                      </div>
                    ))}
                  </div>
                  {dllAmt > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between mb-1.5" style={{ fontSize: 11 }}>
                        <span style={{ color: '#64748b' }}>Daily Loss Limit</span>
                        <span style={{ color: dllBarCol, fontWeight: 500 }}>{acctDllPct}% used</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: '#1e1e2e' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${acctDllPct}%`, background: dllBarCol }} />
                      </div>
                    </div>
                  )}
                  {account.status === 'active' ? (
                    <Link href={`/session/new?account=${account.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-black" style={{ fontSize: 12, background: '#06b6d4' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      Start Session
                    </Link>
                  ) : (
                    <p style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Account {account.status}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {(accounts ?? []).length === 0 && (
        <div className="bg-[#14141e] border border-[#1e1e2e] rounded-xl p-10 text-center mb-6">
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>No accounts yet — add your first prop firm account to get started</p>
          <AddAccountButton firmOptions={(firmRules ?? []) as PropFirmRule[]} userId={user.id} />
        </div>
      )}

      {/* Recent Sessions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#64748b' }}>Recent Sessions</p>
          <Link href="/analytics" style={{ fontSize: 12, color: '#06b6d4' }}>View all →</Link>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-[#14141e] border border-[#1e1e2e] rounded-xl p-10 text-center">
            <p style={{ color: '#64748b', fontSize: 13 }}>No sessions yet — start your first session from an account above</p>
          </div>
        ) : (
          <div className="bg-[#14141e] border border-[#1e1e2e] rounded-xl overflow-hidden">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Account', 'P&L', 'Emotion', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#64748b', padding: '12px 16px', borderBottom: '1px solid #1e1e2e' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  type SessionWithExtra = Session & { pre_emotional_state?: string; prop_accounts?: PropAccount & { prop_firm_rules?: { name: string } } }
                  const sx         = s as SessionWithExtra
                  const sessionPnl = trades.filter(t => t.session_id === s.id).reduce((sum, t) => sum + (t.pnl ?? 0), 0)
                  const hasTrades  = trades.filter(t => t.session_id === s.id).length > 0
                  const emo        = emotionFromState(sx.pre_emotional_state ?? null)
                  const isLast     = i === sessions.length - 1
                  const statusCol  = s.status === 'active' ? '#06b6d4' : s.status === 'completed' ? '#22c55e' : '#64748b'

                  return (
                    <tr key={s.id}>
                      <td style={{ padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #1e1e2e' }}>
                        <Link href={`/session/${s.id}`} style={{ fontSize: 12, color: '#64748b' }}>
                          {new Date(s.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Link>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', borderBottom: isLast ? 'none' : '1px solid #1e1e2e' }}>
                        {sx.prop_accounts?.nickname ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: hasTrades ? (sessionPnl >= 0 ? '#22c55e' : '#ef4444') : '#64748b', borderBottom: isLast ? 'none' : '1px solid #1e1e2e' }}>
                        {hasTrades ? formatPnl(sessionPnl) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #1e1e2e' }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {Array.from({ length: 10 }).map((_, j) => (
                            <div key={j} style={{ width: 5, height: 10, borderRadius: 1, background: j < emo ? '#06b6d4' : '#1e1e2e' }} />
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #1e1e2e' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${statusCol}18`, color: statusCol, border: `1px solid ${statusCol}35` }}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
