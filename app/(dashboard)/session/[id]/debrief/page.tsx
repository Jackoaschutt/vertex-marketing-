'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Session, Trade, CircuitBreakerEvent } from '@/types'

type FollowedRules = 'yes' | 'mostly' | 'no'

function formatDuration(start: string, end: string | null): string {
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  const totalSeconds = Math.floor((endMs - startMs) / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// ─── Markdown-like renderer for AI review ─────────────────────────────────────

function AiReviewText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className="text-teal-400 font-semibold text-xs uppercase tracking-wide mt-4 first:mt-0">
              {line.replace(/\*\*/g, '')}
            </p>
          )
        }
        if (line.match(/^\*\*(.+)\*\*/)) {
          return (
            <p key={i} className="text-slate-200">
              {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                part.startsWith('**') ? (
                  <span key={j} className="font-semibold text-white">{part.replace(/\*\*/g, '')}</span>
                ) : part
              )}
            </p>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

export default function DebriefPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [cbEvents, setCbEvents] = useState<CircuitBreakerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [followedRules, setFollowedRules] = useState<FollowedRules | null>(null)
  const [emotionalRating, setEmotionalRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [willTradeTomorrow, setWillTradeTomorrow] = useState<boolean | null>(null)

  // AI Review state
  const [aiReview, setAiReview] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then(({ session: s, trades: t, cbEvents: cb }) => {
        setSession(s)
        setTrades(t ?? [])
        setCbEvents(cb ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const canSubmit =
    followedRules !== null && emotionalRating !== null && willTradeTomorrow !== null

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0)
  const pnlColor = totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'

  async function handleGetAiReview() {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch(`/api/sessions/${id}/ai-review`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to get AI review')
      setAiReview(data.review)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI review failed')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          end_time: new Date().toISOString(),
          debrief_responses: {
            followed_rules: followedRules,
            emotional_rating: emotionalRating,
            notes,
            will_trade_tomorrow: willTradeTomorrow,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save debrief')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Session not found.</div>
      </div>
    )
  }

  const sessionWithGamePlan = session as Session & { game_plan?: string }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <p className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-1">Post-Session</p>
        <h1 className="text-2xl font-bold text-white">Session Debrief</h1>
        <p className="text-slate-400 text-sm mt-1">
          Take a moment to reflect on your trading session.
        </p>
      </div>

      {/* Session summary */}
      <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-6 mb-6">
        <h2 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-4">
          Session Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label="Total P&L"
            value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
            valueClass={pnlColor}
          />
          <SummaryCard label="Trades" value={String(trades.length)} />
          <SummaryCard
            label="CB Events"
            value={String(cbEvents.length)}
            valueClass={cbEvents.length > 0 ? 'text-amber-400' : undefined}
          />
          <SummaryCard
            label="Duration"
            value={formatDuration(session.start_time, session.end_time)}
          />
        </div>
      </div>

      {/* Game plan recap */}
      {sessionWithGamePlan.game_plan && (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Your Pre-Session Game Plan</p>
          <p className="text-sm text-slate-300 leading-relaxed italic">&ldquo;{sessionWithGamePlan.game_plan}&rdquo;</p>
        </div>
      )}

      {/* AI Session Review */}
      <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-teal-500/20 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8" /><rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <path d="M22 14H2M22 18H2M22 22H2" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">AI Session Review</h2>
            <p className="text-xs text-slate-500">PropGuard AI compares your plan vs execution</p>
          </div>
        </div>

        {!aiReview && !aiLoading && (
          <div>
            {!sessionWithGamePlan.game_plan && (
              <p className="text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
                No game plan was written — start sessions with a plan for better AI analysis.
              </p>
            )}
            <button
              onClick={handleGetAiReview}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-400 hover:text-teal-300 transition-all"
            >
              Get AI Review of This Session →
            </button>
            {aiError && (
              <p className="text-xs text-red-400 mt-2 text-center">{aiError}</p>
            )}
          </div>
        )}

        {aiLoading && (
          <div className="flex items-center justify-center gap-3 py-6">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Analyzing your session…</p>
          </div>
        )}

        {aiReview && (
          <div className="mt-2">
            <AiReviewText text={aiReview} />
            <button
              onClick={() => setAiReview(null)}
              className="text-xs text-slate-600 hover:text-slate-500 mt-4 transition-colors"
            >
              Regenerate review
            </button>
          </div>
        )}
      </div>

      {/* Debrief form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Q1: Rules */}
        <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-slate-200 mb-4">
            <span className="text-teal-400 font-bold mr-2">1.</span>
            Did you follow your rules today?
          </label>
          <div className="flex gap-3">
            {(['yes', 'mostly', 'no'] as FollowedRules[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFollowedRules(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all border ${
                  followedRules === v
                    ? v === 'yes'
                      ? 'bg-emerald-700 border-emerald-500 text-white'
                      : v === 'mostly'
                      ? 'bg-amber-700 border-amber-500 text-white'
                      : 'bg-red-800 border-red-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-zinc-500'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Q2: Emotional control rating */}
        <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-slate-200 mb-4">
            <span className="text-teal-400 font-bold mr-2">2.</span>
            Rate your emotional control (1–10)
          </label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEmotionalRating(n)}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition-all border ${
                  emotionalRating === n
                    ? n >= 7
                      ? 'bg-emerald-700 border-emerald-500 text-white'
                      : n >= 4
                      ? 'bg-amber-700 border-amber-500 text-white'
                      : 'bg-red-800 border-red-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-zinc-500'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {emotionalRating !== null && (
            <p className="text-xs text-slate-500 mt-2">
              {emotionalRating >= 8
                ? 'Excellent emotional discipline'
                : emotionalRating >= 5
                ? 'Average — room to improve'
                : 'Struggled with emotions today'}
            </p>
          )}
        </div>

        {/* Q3: Notes */}
        <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-slate-200 mb-3">
            <span className="text-teal-400 font-bold mr-2">3.</span>
            Session notes{' '}
            <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What went well? What do you want to do differently next session?"
            rows={4}
            className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 placeholder:text-zinc-600 resize-none"
          />
        </div>

        {/* Q4: Will trade tomorrow */}
        <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-slate-200 mb-4">
            <span className="text-teal-400 font-bold mr-2">4.</span>
            Will you trade tomorrow?
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setWillTradeTomorrow(true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                willTradeTomorrow === true
                  ? 'bg-emerald-700 border-emerald-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-zinc-500'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setWillTradeTomorrow(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                willTradeTomorrow === false
                  ? 'bg-slate-600 border-zinc-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-zinc-500'
              }`}
            >
              No
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full py-4 rounded-xl font-semibold bg-teal-500 hover:bg-teal-400 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20"
        >
          {submitting ? 'Saving...' : 'Save Debrief & End Session'}
        </button>
      </form>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold font-mono tabular-nums ${valueClass ?? 'text-white'}`}>
        {value}
      </span>
    </div>
  )
}
