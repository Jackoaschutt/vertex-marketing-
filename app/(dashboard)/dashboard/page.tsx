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
    active: 'bg-teal-950 text-teal-300 border border-teal-800/40',
    passed: 'bg-green-950 text-green-400 border border-green-800/40',
    failed: 'bg-red-950 text-red-400 border border-red-800/40',
  }
  return `inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-zinc-800 text-zinc-400'}`
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

  const trades = (weekTrades ?? []) as (Trade & { created_at: string })[]
  const weekPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const weekWins = trades.filter((t) => t.result === 'win').length
  const winRate =
    trades.length > 0 ? Math.round((weekWins / trades.length) * 100) : null

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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting()}, {user.email?.split('@')[0]}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">{user.email}</p>
        </div>
        <AddAccountButton
          firmOptions={(firmRules ?? []) as PropFirmRule[]}
          userId={user.id}
        />
      </div>

      {/* ── Week Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-medium">Week P&amp;L</p>
          <p
            className={`text-2xl font-bold font-mono tabular-nums ${
              weekPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatPnl(weekPnl)}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-medium">Sessions This Week</p>
          <p className="text-2xl font-bold text-white font-mono tabular-nums">
            {(recentSessions ?? []).length}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-medium">Win Rate This Week</p>
          <p className={`text-2xl font-bold font-mono tabular-nums ${
            winRate === null ? 'text-white' : winRate >= 50 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {winRate !== null ? `${winRate}%` : '—'}
          </p>
        </div>
      </div>

      {/* ── Prop Account Cards ── */}
      {(accounts ?? []).length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Accounts
          </h2>
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

              return (
                <div key={account.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{account.nickname}</span>
                    <span className={statusBadge(account.status)}>
                      {account.status}
                    </span>
                  </div>

                  <div className="text-sm text-zinc-400">
                    {rules?.name ?? 'Custom'} &middot;{' '}
                    {account.starting_balance.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    })}
                  </div>

                  {dllAmount > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Daily Loss Limit</span>
                        <span
                          className={
                            dllPct >= 80
                              ? 'text-red-400'
                              : dllPct >= 50
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {dllPct}% used
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                    >
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
                      </svg>
                      Start Session
                    </Link>
                  ) : (
                    <p className="text-xs text-zinc-500 italic capitalize">
                      Account {account.status}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 text-sm">
            No accounts yet —{' '}
            <AddAccountButton
              firmOptions={(firmRules ?? []) as PropFirmRule[]}
              userId={user.id}
            />
          </p>
        </div>
      )}

      {/* ── Recent Sessions ── */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Recent Sessions
        </h2>

        {(recentSessions ?? []).length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">
              No sessions yet — start your first session above
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    P&amp;L
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Trades
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    CB Events
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
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
                      className="hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                        <Link
                          href={`/session/${session.id}`}
                          className="hover:text-teal-400 transition-colors"
                        >
                          {formatDate(session.start_time)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {acct?.nickname ?? '—'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium font-mono tabular-nums ${
                          sessionPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {sessionTrades > 0 ? formatPnl(sessionPnl) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono tabular-nums">
                        {sessionTrades > 0 ? sessionTrades : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400">—</td>
                      <td className="px-4 py-3">
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
