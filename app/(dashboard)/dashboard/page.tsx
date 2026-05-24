import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { PropAccount, PropFirmRule, Session, Trade } from '@/types'
import AddAccountButton from './AddAccountButton'

// ─── helpers ────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatPnl(v: number) {
  const abs = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    passed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
    open: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    closed: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  }
  return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-slate-800 text-slate-400'}`
}

function dllBarColor(pct: number) {
  if (pct >= 80) return 'bg-red-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    .limit(5)

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

  // Fetch all completed sessions for PropScore
  const { data: allCompletedSessions } = await supabase
    .from('sessions')
    .select('has_setup, debrief_responses')
    .in('prop_account_id', accountIds.length ? accountIds : ['__none__'])
    .eq('status', 'completed')

  const completedSessions = allCompletedSessions ?? []

  // PropScore: 0-100 discipline metric
  const totalCompleted = completedSessions.length
  const hasSetupRate = totalCompleted > 0
    ? completedSessions.filter(s => s.has_setup === true).length / totalCompleted
    : 0
  const sessionsWithDebrief = completedSessions.filter(s => s.debrief_responses)
  const adherenceRate = sessionsWithDebrief.length > 0
    ? sessionsWithDebrief.filter(s =>
        s.debrief_responses?.followed_rules === 'yes' ||
        s.debrief_responses?.followed_rules === 'mostly'
      ).length / sessionsWithDebrief.length
    : 0
  const debriefCompletionRate = totalCompleted > 0
    ? sessionsWithDebrief.length / totalCompleted
    : 0

  const trades = (weekTrades ?? []) as (Trade & { created_at: string })[]
  const weekPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const weekWins = trades.filter((t) => t.result === 'win').length
  const winRate =
    trades.length > 0 ? Math.round((weekWins / trades.length) * 100) : null

  const weekWinRate = trades.length > 0 ? weekWins / trades.length : 0
  const propScore = totalCompleted === 0 ? null : Math.round(
    (weekWinRate * 25) +
    (adherenceRate * 30) +
    (debriefCompletionRate * 25) +
    (hasSetupRate * 20)
  )

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  function todayPnlForAccount(accountId: string) {
    const todaySessions = (recentSessions ?? [])
      .filter(
        (s: Session) =>
          s.prop_account_id === accountId &&
          new Date(s.start_time) >= todayStart
      )
      .map((s: Session) => s.id)

    return trades
      .filter((t) => todaySessions.includes(t.session_id))
      .reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  }

  const pnlColor = weekPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
  const pnlGlow = weekPnl >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
  const pnlIconBg = weekPnl >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'
  const pnlIconColor = weekPnl >= 0 ? 'text-emerald-400' : 'text-red-400'

  const winRateColor =
    winRate === null ? 'text-slate-300' : winRate >= 50 ? 'text-teal-400' : 'text-red-400'
  const winRateGlow = winRate !== null && winRate >= 50 ? 'bg-teal-500/20' : 'bg-violet-500/20'

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting()},{' '}
            <span className="text-teal-400">{user.email?.split('@')[0]}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here&apos;s what&apos;s happening with your accounts this week.
          </p>
        </div>
        <AddAccountButton
          firmOptions={(firmRules ?? []) as PropFirmRule[]}
          userId={user.id}
        />
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

        {/* Week P&L */}
        <div className="relative bg-gradient-to-br from-[#0d1526] to-[#0b1020] border border-slate-800/60 rounded-2xl p-5 overflow-hidden">
          <div className={`absolute -top-6 -right-6 w-24 h-24 ${pnlGlow} rounded-full blur-2xl pointer-events-none`} />
          <div className={`w-9 h-9 rounded-xl ${pnlIconBg} border border-white/5 flex items-center justify-center mb-4`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pnlIconColor}>
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <p className={`text-2xl font-bold font-mono tabular-nums ${pnlColor}`}>
            {formatPnl(weekPnl)}
          </p>
          <p className="text-slate-500 text-xs mt-1 font-medium uppercase tracking-wide">Week P&amp;L</p>
        </div>

        {/* Sessions This Week */}
        <div className="relative bg-gradient-to-br from-[#0d1526] to-[#0b1020] border border-slate-800/60 rounded-2xl p-5 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-white/5 flex items-center justify-center mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-white font-mono tabular-nums">
            {(recentSessions ?? []).length}
          </p>
          <p className="text-slate-500 text-xs mt-1 font-medium uppercase tracking-wide">Sessions This Week</p>
        </div>

        {/* Win Rate */}
        <div className="relative bg-gradient-to-br from-[#0d1526] to-[#0b1020] border border-slate-800/60 rounded-2xl p-5 overflow-hidden">
          <div className={`absolute -top-6 -right-6 w-24 h-24 ${winRateGlow} rounded-full blur-2xl pointer-events-none`} />
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-white/5 flex items-center justify-center mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <p className={`text-2xl font-bold font-mono tabular-nums ${winRateColor}`}>
            {winRate !== null ? `${winRate}%` : '—'}
          </p>
          <p className="text-slate-500 text-xs mt-1 font-medium uppercase tracking-wide">Win Rate This Week</p>
          {trades.length > 0 && (
            <p className="text-slate-600 text-xs mt-0.5">{weekWins}W / {trades.length - weekWins}L</p>
          )}
        </div>

        {/* PropScore */}
        <div className="relative bg-gradient-to-br from-[#0d1526] to-[#0b1020] border border-slate-800/60 rounded-2xl p-5 overflow-hidden">
          <div className={`absolute -top-6 -right-6 w-24 h-24 ${
            propScore === null ? 'bg-slate-500/10' : propScore >= 70 ? 'bg-teal-500/20' : propScore >= 45 ? 'bg-amber-500/20' : 'bg-red-500/20'
          } rounded-full blur-2xl pointer-events-none`} />
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-white/5 flex items-center justify-center mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <p className={`text-2xl font-bold font-mono tabular-nums ${
            propScore === null ? 'text-slate-500' : propScore >= 70 ? 'text-teal-400' : propScore >= 45 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {propScore !== null ? `${propScore}` : '—'}
          </p>
          <p className="text-slate-500 text-xs mt-1 font-medium uppercase tracking-wide">PropScore</p>
          {propScore !== null && (
            <p className="text-slate-600 text-xs mt-0.5">
              {propScore >= 70 ? 'Disciplined' : propScore >= 45 ? 'Developing' : 'Needs work'}
            </p>
          )}
          {propScore === null && (
            <p className="text-slate-600 text-xs mt-0.5">Complete sessions to score</p>
          )}
        </div>
      </div>

      {/* ── Prop Account Cards ── */}
      {(accounts ?? []).length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Accounts
            </h2>
            <Link href="/accounts" className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(accounts as PropAccount[]).map((account) => {
              const rules = account.prop_firm_rules as PropFirmRule | undefined
              const todayPnl = todayPnlForAccount(account.id)
              const dllAmount = rules?.dll_amount ?? 0
              const dllPct =
                dllAmount > 0
                  ? Math.min(
                      100,
                      Math.round((Math.abs(Math.min(0, todayPnl)) / dllAmount) * 100)
                    )
                  : 0

              const acctBorderColor =
                account.status === 'active'
                  ? 'border-teal-500/40'
                  : account.status === 'passed'
                  ? 'border-emerald-500/40'
                  : 'border-red-500/40'

              const acctGlow =
                account.status === 'active'
                  ? 'bg-teal-500/10'
                  : account.status === 'passed'
                  ? 'bg-emerald-500/10'
                  : 'bg-red-500/10'

              return (
                <div
                  key={account.id}
                  className={`relative bg-gradient-to-br from-[#0d1526] to-[#0a1018] border ${acctBorderColor} rounded-2xl p-5 space-y-4 overflow-hidden hover:border-teal-500/60 transition-colors`}
                >
                  <div className={`absolute -bottom-6 -right-6 w-28 h-28 ${acctGlow} rounded-full blur-2xl pointer-events-none`} />

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white text-base">{account.nickname}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{rules?.name ?? 'Custom'}</p>
                    </div>
                    <span className={statusBadge(account.status)}>
                      {account.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500 mb-0.5">Balance</p>
                      <p className="text-sm font-semibold text-white font-mono">
                        {account.starting_balance.toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500 mb-0.5">Today P&amp;L</p>
                      <p className={`text-sm font-semibold font-mono ${todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPnl(todayPnl)}
                      </p>
                    </div>
                  </div>

                  {dllAmount > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Daily Loss Limit</span>
                        <span
                          className={
                            dllPct >= 80
                              ? 'text-red-400 font-medium'
                              : dllPct >= 50
                              ? 'text-amber-400 font-medium'
                              : 'text-slate-400'
                          }
                        >
                          {dllPct}% used
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${dllBarColor(dllPct)}`}
                          style={{ width: `${dllPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {account.status === 'active' ? (
                    <Link
                      href={`/session/new?account=${account.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-white transition-colors shadow-lg shadow-teal-500/20"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Start Session
                    </Link>
                  ) : (
                    <p className="text-xs text-slate-500 italic capitalize">
                      Account {account.status}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-400">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <p className="text-slate-300 text-sm font-medium mb-1">No accounts yet</p>
          <p className="text-slate-500 text-xs mb-4">Add your first prop firm account to get started</p>
          <AddAccountButton
            firmOptions={(firmRules ?? []) as PropFirmRule[]}
            userId={user.id}
          />
        </div>
      )}

      {/* ── Recent Sessions ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Recent Sessions
          </h2>
          <Link href="/analytics" className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
            View all →
          </Link>
        </div>

        {(recentSessions ?? []).length === 0 ? (
          <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-1">No sessions yet</p>
            <p className="text-slate-600 text-xs">Start your first session from an account above</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    P&amp;L
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Trades
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    CB Events
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(recentSessions as Session[]).map((session) => {
                  const sessionPnl = trades
                    .filter((t) => t.session_id === session.id)
                    .reduce((sum, t) => sum + (t.pnl ?? 0), 0)
                  const sessionTrades = trades.filter(
                    (t) => t.session_id === session.id
                  ).length
                  const acct = session.prop_accounts as
                    | (PropAccount & { prop_firm_rules?: { name: string } })
                    | undefined

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/session/${session.id}`}
                          className="text-slate-300 hover:text-teal-400 transition-colors text-sm"
                        >
                          {formatDate(session.start_time)}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-slate-300 text-sm">{acct?.nickname ?? '—'}</span>
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-semibold font-mono tabular-nums text-sm ${
                          sessionPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {sessionTrades > 0 ? formatPnl(sessionPnl) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-400 font-mono tabular-nums text-sm">
                        {sessionTrades > 0 ? sessionTrades : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600 text-sm">—</td>
                      <td className="px-4 py-3.5">
                        <span className={statusBadge(session.status)}>
                          {session.status}
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
