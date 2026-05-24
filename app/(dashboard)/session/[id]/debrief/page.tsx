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
        <div className="text-zinc-400 text-sm">Session not found.</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <p className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-1">Post-Session</p>
        <h1 className="text-2xl font-bold text-white">Session Debrief</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Take a moment to reflect on your trading session.
        </p>
      </div>

      {/* Session summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
        <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-4">
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

      {/* Debrief form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Q1: Rules */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-zinc-200 mb-4">
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
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Q2: Emotional control rating */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-zinc-200 mb-4">
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
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {emotionalRating !== null && (
            <p className="text-xs text-zinc-500 mt-2">
              {emotionalRating >= 8
                ? 'Excellent emotional discipline'
                : emotionalRating >= 5
                ? 'Average — room to improve'
                : 'Struggled with emotions today'}
            </p>
          )}
        </div>

        {/* Q3: Notes */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-zinc-200 mb-3">
            <span className="text-teal-400 font-bold mr-2">3.</span>
            Session notes{' '}
            <span className="text-zinc-500 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What went well? What do you want to do differently next session?"
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 placeholder:text-zinc-600 resize-none"
          />
        </div>

        {/* Q4: Will trade tomorrow */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-zinc-200 mb-4">
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
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setWillTradeTomorrow(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                willTradeTomorrow === false
                  ? 'bg-zinc-600 border-zinc-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
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
          className="w-full py-4 rounded-xl font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold font-mono tabular-nums ${valueClass ?? 'text-white'}`}>
        {value}
      </span>
    </div>
  )
}
