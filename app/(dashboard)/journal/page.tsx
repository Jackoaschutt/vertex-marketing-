import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { computeAnalytics } from '@/lib/analytics/engine'
import type { Session, SetupType } from '@/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatPnl(v: number) {
  const abs = Math.abs(v).toFixed(2)
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}

const ROUTINE_STEPS = [
  {
    phase: 'Pre-Session',
    color: 'teal',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    borderColor: 'border-teal-500/30',
    steps: [
      { title: 'Mark key levels', desc: 'Identify yesterday\'s high/low, weekly range, and major S/R before markets open.' },
      { title: 'Write your game plan', desc: 'Describe the exact price action you need to see before entering. No plan = no trade.' },
      { title: 'Check your emotional state', desc: 'Rate yourself 1–10. If you\'re below 6, consider sitting out.' },
      { title: 'Set your max loss for the day', desc: 'Never enter without knowing exactly when you\'ll stop. This is your DLL.' },
    ],
  },
  {
    phase: 'During Session',
    color: 'amber',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    steps: [
      { title: 'Only take planned setups', desc: 'If the setup isn\'t in your game plan, pass. FOMO kills accounts.' },
      { title: 'Tag every trade', desc: 'Log instrument, direction, result, emotional state, and any mistakes in real-time.' },
      { title: 'Watch the circuit breaker', desc: 'At 50% DLL, pause and assess. At 80%, end the session — no exceptions.' },
      { title: 'After a loss, wait 5 minutes', desc: 'Don\'t enter the next trade immediately. Revenge trading is the #1 account killer.' },
    ],
  },
  {
    phase: 'Post-Session',
    color: 'violet',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    steps: [
      { title: 'Complete the debrief', desc: 'Answer all four debrief questions honestly — rule adherence, emotional rating, notes, tomorrow.' },
      { title: 'Review every trade', desc: 'Look at each trade: was it in the plan? Was the entry valid? Tag mistakes if any.' },
      { title: 'Calculate your mistake cost', desc: 'Check Analytics → Mistake Cost Analysis to see how much bad habits are costing you.' },
      { title: 'Identify your best day pattern', desc: 'Check Analytics → Best & Worst Days. Schedule your best sessions on your best days.' },
    ],
  },
]

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accounts } = await supabase
    .from('prop_accounts')
    .select('id')
    .eq('trader_id', user.id)
  const accountIds = accounts?.map(a => a.id) ?? []

  const { data: completedSessions } = await supabase
    .from('sessions')
    .select('*')
    .in('prop_account_id', accountIds.length > 0 ? accountIds : ['__none__'])
    .eq('status', 'completed')
    .order('start_time', { ascending: false })
    .limit(30)

  const sessionIds = (completedSessions ?? []).map(s => s.id)

  const [{ data: trades }, { data: cbEvents }, { data: setupTypes }] = await Promise.all([
    supabase.from('trades').select('*').in('session_id', sessionIds.length > 0 ? sessionIds : ['__none__']),
    supabase.from('circuit_breaker_events').select('*').in('session_id', sessionIds.length > 0 ? sessionIds : ['__none__']),
    supabase.from('setup_types').select('*').eq('trader_id', user.id),
  ])

  const analytics = computeAnalytics(
    completedSessions ?? [],
    trades ?? [],
    cbEvents ?? [],
    setupTypes as SetupType[] ?? []
  )

  // Best/worst day
  const sortedDays = [...analytics.pnl_by_day_of_week].sort((a, b) => b.avg_pnl - a.avg_pnl)
  const bestDay = sortedDays[0] ?? null
  const worstDay = sortedDays[sortedDays.length - 1] ?? null

  // Best setup
  const sortedSetups = [...analytics.win_rate_by_setup].sort((a, b) => b.win_rate - a.win_rate)
  const bestSetup = sortedSetups[0] ?? null

  // Debrief streak — count consecutive sessions with debrief from most recent
  const sorted = [...(completedSessions ?? [])].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  )
  let streak = 0
  for (const s of sorted as Session[]) {
    if (s.debrief_responses) streak++
    else break
  }

  // Sessions with notes (non-empty)
  const sessionsWithNotes = (completedSessions ?? [] as Session[]).filter(
    (s: Session) => s.debrief_responses?.notes && s.debrief_responses.notes.trim().length > 0
  ).slice(0, 5)

  const hasSessions = (completedSessions ?? []).length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Journal</h1>
          <p className="text-slate-500 text-sm mt-1">
            Build strict daily habits to identify your best and worst patterns
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white transition-colors shadow-lg shadow-teal-500/20"
        >
          Start Session →
        </Link>
      </div>

      {/* Key Insights (only if data exists) */}
      {hasSessions && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Debrief Streak */}
          <div className="relative bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-teal-500/30 rounded-2xl p-5 overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-white/5 flex items-center justify-center mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <p className={`text-3xl font-bold font-mono ${streak > 0 ? 'text-teal-400' : 'text-slate-500'}`}>
              {streak}
            </p>
            <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide">Debrief Streak</p>
            <p className="text-slate-600 text-xs mt-0.5">consecutive sessions</p>
          </div>

          {/* Best Day */}
          {bestDay && (
            <div className="relative bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-emerald-500/30 rounded-2xl p-5 overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-white/5 flex items-center justify-center mb-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                </svg>
              </div>
              <p className="text-lg font-bold text-white">{bestDay.day}</p>
              <p className="text-emerald-400 font-mono text-sm font-semibold">{formatPnl(bestDay.avg_pnl)} avg</p>
              <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide">Best Day</p>
            </div>
          )}

          {/* Worst Day */}
          {worstDay && worstDay.day !== bestDay?.day && (
            <div className="relative bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-red-500/30 rounded-2xl p-5 overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-red-500/15 rounded-full blur-2xl pointer-events-none" />
              <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-white/5 flex items-center justify-center mb-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                </svg>
              </div>
              <p className="text-lg font-bold text-white">{worstDay.day}</p>
              <p className="text-red-400 font-mono text-sm font-semibold">{formatPnl(worstDay.avg_pnl)} avg</p>
              <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide">Worst Day — Consider Avoiding</p>
            </div>
          )}
        </div>
      )}

      {/* Best setup insight */}
      {bestSetup && (
        <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-violet-500/30 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-white/5 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs text-violet-400/70 uppercase tracking-wide font-semibold">Best Performing Setup</p>
            <p className="text-white font-semibold mt-0.5">{bestSetup.dimension}</p>
            <p className="text-slate-500 text-xs">
              {Math.round(bestSetup.win_rate * 100)}% win rate across {bestSetup.total} trade{bestSetup.total !== 1 ? 's' : ''} · Avg {formatPnl(bestSetup.avg_pnl)}
            </p>
          </div>
          <Link href="/analytics" className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium">
            View Playbook →
          </Link>
        </div>
      )}

      {/* Daily Routine Guide */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-white">Daily Journaling Routine</h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
            12 steps
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ROUTINE_STEPS.map((phase) => (
            <div
              key={phase.phase}
              className={`bg-gradient-to-br from-[#0d1526] to-[#0a1018] border ${phase.borderColor} rounded-2xl p-5`}
            >
              <div className={`w-8 h-8 rounded-xl ${phase.iconBg} border border-white/5 flex items-center justify-center mb-3`}>
                {phase.color === 'teal' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                )}
                {phase.color === 'amber' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                )}
                {phase.color === 'violet' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                )}
              </div>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${phase.iconColor}`}>
                {phase.phase}
              </p>
              <div className="space-y-3">
                {phase.steps.map((step, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className={`w-5 h-5 rounded-full ${phase.iconBg} border ${phase.borderColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <span className={`text-xs font-bold ${phase.iconColor}`}>{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white leading-snug">{step.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Journal Entries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Recent Debrief Notes</h2>
          <Link href="/analytics" className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
            Full Analytics →
          </Link>
        </div>

        {sessionsWithNotes.length === 0 ? (
          <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm font-medium">No journal notes yet</p>
            <p className="text-slate-600 text-xs mt-1">Add notes during your post-session debrief</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(sessionsWithNotes as Session[]).map((session) => {
              const debrief = session.debrief_responses!
              const sessionTrades = (trades ?? []).filter(t => t.session_id === session.id)
              const sessionPnl = sessionTrades.reduce((sum, t) => sum + t.pnl, 0)

              const adherenceColor =
                debrief.followed_rules === 'yes'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : debrief.followed_rules === 'mostly'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-red-400 bg-red-500/10 border-red-500/20'

              return (
                <div
                  key={session.id}
                  className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-4 hover:border-slate-700/80 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-300">{formatDate(session.start_time)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${adherenceColor}`}>
                        {debrief.followed_rules}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        Emotion: <span className={`font-semibold ${debrief.emotional_rating >= 7 ? 'text-emerald-400' : debrief.emotional_rating >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{debrief.emotional_rating}/10</span>
                      </span>
                      <span className={`text-sm font-semibold font-mono ${sessionPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPnl(sessionPnl)}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{debrief.notes}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PropGuard Tips */}
      <div className="bg-gradient-to-br from-teal-500/5 to-[#0a1018] border border-teal-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-400 mb-2">The PropGuard Discipline Formula</p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <p>1. <span className="text-white font-medium">Trade only on your best days</span> — check Best & Worst Days in Analytics and schedule accordingly.</p>
              <p>2. <span className="text-white font-medium">Only trade your best setup</span> — identify your highest win rate setup in Playbook Performance and specialise in it.</p>
              <p>3. <span className="text-white font-medium">Tag every mistake</span> — if you see FOMO, revenge, or oversize in the trade form, tag it. Watch the cost add up in analytics — it will shock you into better behavior.</p>
              <p>4. <span className="text-white font-medium">Complete every debrief</span> — even 30-second sessions. A consistent debrief streak is the single best predictor of long-term profitability.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
