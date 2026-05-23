'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TradingSession } from '@/types'

const TRADING_SESSIONS: { value: TradingSession; label: string }[] = [
  { value: 'LONDON', label: 'London Open' },
  { value: 'NY_OPEN', label: 'NY Open' },
  { value: 'NY_CLOSE', label: 'NY Close' },
  { value: 'ASIA', label: 'Asia' },
  { value: 'OTHER', label: 'Other' },
]

const EMOTIONAL_STATES = [
  { value: 'Calm', emoji: '😌' },
  { value: 'Focused', emoji: '🎯' },
  { value: 'Anxious', emoji: '😰' },
  { value: 'Frustrated', emoji: '😤' },
  { value: 'Euphoric', emoji: '🤑' },
]

export default function NewSessionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('account') ?? ''

  const [accountName, setAccountName] = useState<string | null>(null)
  const [firmName, setFirmName] = useState<string | null>(null)
  const [tradingSession, setTradingSession] = useState<TradingSession | ''>('')
  const [emotionalState, setEmotionalState] = useState('')
  const [hasSetup, setHasSetup] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId) return
    const supabase = createClient()
    supabase
      .from('prop_accounts')
      .select('nickname, prop_firm_rules(name)')
      .eq('id', accountId)
      .single()
      .then(({ data }) => {
        if (data) {
          setAccountName(data.nickname)
          // prop_firm_rules may be an array or object depending on join type
          const rules = data.prop_firm_rules
          if (Array.isArray(rules) && rules.length > 0) {
            setFirmName((rules[0] as { name: string }).name)
          } else if (rules && !Array.isArray(rules)) {
            setFirmName((rules as { name: string }).name)
          }
        }
      })
  }, [accountId])

  const canSubmit = tradingSession !== '' && emotionalState !== '' && hasSetup !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prop_account_id: accountId,
          trading_session: tradingSession,
          pre_emotional_state: emotionalState,
          has_setup: hasSetup,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to start session')
      }

      const { session } = await res.json()
      router.push(`/session/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center py-12">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sky-400 text-xs font-semibold uppercase tracking-wider">
              Pre-Session Check
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Start Trading Session</h1>
          {accountName && (
            <p className="text-zinc-400 text-sm mt-1">
              {accountName}
              {firmName && (
                <span className="text-zinc-500"> · {firmName}</span>
              )}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-7">
          {/* Question 1 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-200 mb-3">
              <span className="text-sky-500 font-bold mr-2">1.</span>
              Which session are you trading?
            </label>
            <select
              value={tradingSession}
              onChange={(e) => setTradingSession(e.target.value as TradingSession)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 appearance-none cursor-pointer"
            >
              <option value="">Select a session...</option>
              {TRADING_SESSIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Question 2 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-200 mb-3">
              <span className="text-sky-500 font-bold mr-2">2.</span>
              How are you feeling right now?
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOTIONAL_STATES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setEmotionalState(s.value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    emotionalState === s.value
                      ? 'bg-sky-700 border-sky-500 text-white scale-105 shadow-lg shadow-sky-900/30'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{s.emoji}</span>
                  {s.value}
                </button>
              ))}
            </div>
          </div>

          {/* Question 3 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-200 mb-3">
              <span className="text-sky-500 font-bold mr-2">3.</span>
              Do you have a clear setup / trade plan?
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHasSetup(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${
                  hasSetup === true
                    ? 'bg-green-700 border-green-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setHasSetup(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${
                  hasSetup === false
                    ? 'bg-red-800 border-red-600 text-white'
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
            disabled={!canSubmit || loading}
            className="w-full py-3.5 rounded-xl font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm mt-2"
          >
            {loading ? 'Starting session...' : 'Start Session'}
          </button>
        </form>
      </div>
    </div>
  )
}
