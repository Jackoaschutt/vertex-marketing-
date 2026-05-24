'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TradingSession } from '@/types'

const TRADING_SESSIONS: { value: TradingSession; label: string; emoji: string; time: string }[] = [
  { value: 'LONDON', label: 'London Open', emoji: '🇬🇧', time: '3–5am EST' },
  { value: 'NY_OPEN', label: 'NY Open', emoji: '🗽', time: '9:30am EST' },
  { value: 'NY_CLOSE', label: 'NY Close', emoji: '🌆', time: '3–4pm EST' },
  { value: 'ASIA', label: 'Asia', emoji: '🏯', time: '7pm–2am EST' },
  { value: 'OTHER', label: 'Other', emoji: '🌍', time: 'Custom' },
]

const EMOTIONAL_STATES = [
  { value: 'Calm', emoji: '😌', color: 'emerald', desc: 'Clear headed, relaxed' },
  { value: 'Focused', emoji: '🎯', color: 'sky', desc: 'Locked in, sharp' },
  { value: 'Anxious', emoji: '😰', color: 'yellow', desc: 'Nervous, second-guessing' },
  { value: 'Frustrated', emoji: '😤', color: 'orange', desc: 'Annoyed, edge taking over' },
  { value: 'Euphoric', emoji: '🤑', color: 'purple', desc: 'Overconfident, chasing' },
]

const TOTAL_STEPS = 4

export default function NewSessionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('account') ?? ''

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  const [accountName, setAccountName] = useState<string | null>(null)
  const [firmName, setFirmName] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [checkingActive, setCheckingActive] = useState(true)

  const [tradingSession, setTradingSession] = useState<TradingSession | ''>('')
  const [emotionalState, setEmotionalState] = useState('')
  const [hasSetup, setHasSetup] = useState<boolean | null>(null)
  const [gamePlan, setGamePlan] = useState('')

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
          const rules = data.prop_firm_rules
          if (Array.isArray(rules) && rules.length > 0) {
            setFirmName((rules[0] as { name: string }).name)
          } else if (rules && !Array.isArray(rules)) {
            setFirmName((rules as { name: string }).name)
          }
        }
      })

    fetch(`/api/sessions?account_id=${accountId}`)
      .then(r => r.json())
      .then(({ session }) => {
        if (session?.id) setActiveSessionId(session.id)
      })
      .finally(() => setCheckingActive(false))
  }, [accountId])

  function next() {
    setDirection('forward')
    setStep(s => Math.min(s + 1, TOTAL_STEPS))
  }
  function back() {
    setDirection('back')
    setStep(s => Math.max(s - 1, 1))
  }

  const step1Valid = tradingSession !== ''
  const step2Valid = emotionalState !== ''
  const step3Valid = hasSetup !== null
  const step4Valid = gamePlan.trim().length >= 15

  async function handleSubmit() {
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
          game_plan: gamePlan.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409 && data.error?.includes('Active session')) {
          const check = await fetch(`/api/sessions?account_id=${accountId}`)
          const { session } = await check.json()
          if (session?.id) {
            router.push(`/session/${session.id}`)
            return
          }
        }
        throw new Error(data.error ?? 'Failed to start session')
      }

      const { session } = await res.json()
      router.push(`/session/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  if (checkingActive) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (activeSessionId) {
    return (
      <div className="min-h-full flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md text-center">
          <div className="text-6xl mb-6">⚡</div>
          <h1 className="text-2xl font-bold text-white mb-2">Session In Progress</h1>
          <p className="text-zinc-400 mb-8">
            You already have an active trading session running.
          </p>
          <button
            onClick={() => router.push(`/session/${activeSessionId}`)}
            className="w-full py-4 rounded-2xl font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all text-lg shadow-lg shadow-sky-900/30 hover:shadow-sky-900/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            Resume Session →
          </button>
          <button
            onClick={() => router.back()}
            className="mt-3 w-full py-3 rounded-2xl font-medium text-zinc-400 hover:text-white transition-colors text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-6 text-center">
          <p className="text-sky-400 text-xs font-bold uppercase tracking-widest mb-1">Pre-Session Check</p>
          <h1 className="text-3xl font-black text-white">
            {accountName ?? 'Start Trading'}
          </h1>
          {firmName && <p className="text-zinc-500 text-sm mt-1">{firmName}</p>}
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < step ? 'bg-sky-500' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>

        {/* Step card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">

          {/* Step 1: Which session */}
          {step === 1 && (
            <div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-1">Step 1 of {TOTAL_STEPS}</p>
              <h2 className="text-xl font-bold text-white mb-6">Which session are you trading?</h2>
              <div className="flex flex-col gap-2">
                {TRADING_SESSIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setTradingSession(s.value)}
                    className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all border ${
                      tradingSession === s.value
                        ? 'bg-sky-900/40 border-sky-500 shadow-lg shadow-sky-900/20'
                        : 'bg-zinc-800/60 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="text-2xl">{s.emoji}</span>
                    <div>
                      <p className={`font-semibold text-sm ${tradingSession === s.value ? 'text-sky-300' : 'text-white'}`}>{s.label}</p>
                      <p className="text-zinc-500 text-xs">{s.time}</p>
                    </div>
                    {tradingSession === s.value && (
                      <span className="ml-auto text-sky-400 text-lg">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Emotional state */}
          {step === 2 && (
            <div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-1">Step 2 of {TOTAL_STEPS}</p>
              <h2 className="text-xl font-bold text-white mb-2">How are you feeling right now?</h2>
              <p className="text-zinc-500 text-sm mb-6">Be honest — this protects you.</p>
              <div className="flex flex-col gap-2">
                {EMOTIONAL_STATES.map((s) => {
                  const selected = emotionalState === s.value
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setEmotionalState(s.value)}
                      className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all border ${
                        selected
                          ? 'bg-zinc-700 border-zinc-500 shadow-lg'
                          : 'bg-zinc-800/60 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="text-3xl">{s.emoji}</span>
                      <div>
                        <p className="font-semibold text-sm text-white">{s.value}</p>
                        <p className="text-zinc-400 text-xs">{s.desc}</p>
                      </div>
                      {selected && <span className="ml-auto text-zinc-300 text-lg">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: Clear setup */}
          {step === 3 && (
            <div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-1">Step 3 of {TOTAL_STEPS}</p>
              <h2 className="text-xl font-bold text-white mb-2">Do you have a clear setup?</h2>
              <p className="text-zinc-500 text-sm mb-8">A defined, backtested trade plan — not a gut feeling.</p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setHasSetup(true)}
                  className={`w-full py-5 rounded-2xl text-lg font-bold transition-all border ${
                    hasSetup === true
                      ? 'bg-emerald-800/60 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-900/20'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  ✅ Yes, I have a plan
                </button>
                <button
                  type="button"
                  onClick={() => setHasSetup(false)}
                  className={`w-full py-5 rounded-2xl text-lg font-bold transition-all border ${
                    hasSetup === false
                      ? 'bg-red-900/50 border-red-600 text-red-300 shadow-lg shadow-red-900/20'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  ❌ No, just vibing
                </button>
              </div>
              {hasSetup === false && (
                <p className="mt-4 text-sm text-amber-400/80 bg-amber-900/10 border border-amber-800/30 rounded-xl px-4 py-3">
                  ⚠️ Trading without a setup is how accounts get blown. Consider waiting for a setup to form.
                </p>
              )}
            </div>
          )}

          {/* Step 4: Game plan text */}
          {step === 4 && (
            <div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-1">Step 4 of {TOTAL_STEPS}</p>
              <h2 className="text-xl font-bold text-white mb-2">What are you looking to see?</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Describe the specific price action or setup you need before pulling the trigger.
                You can&apos;t skip this — accountability starts here.
              </p>
              <textarea
                value={gamePlan}
                onChange={(e) => setGamePlan(e.target.value)}
                placeholder="e.g. I'm waiting for a break and retest of the NY open high, with a clean FVG and bullish displacement before entry. Min 2:1 RR only."
                rows={5}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none placeholder:text-zinc-600 leading-relaxed"
              />
              <div className="flex items-center justify-between mt-2 px-1">
                <p className={`text-xs transition-colors ${gamePlan.trim().length >= 15 ? 'text-emerald-500' : 'text-zinc-600'}`}>
                  {gamePlan.trim().length >= 15 ? '✓ Good' : `${Math.max(0, 15 - gamePlan.trim().length)} more chars needed`}
                </p>
                <p className="text-zinc-600 text-xs">{gamePlan.trim().length} chars</p>
              </div>

              {error && (
                <p className="mt-4 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}
            </div>
          )}

        </div>

        {/* Nav buttons */}
        <div className="flex gap-3 mt-5">
          {step > 1 && (
            <button
              onClick={back}
              className="px-5 py-3.5 rounded-2xl font-semibold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-all text-sm"
            >
              ← Back
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={next}
              disabled={
                (step === 1 && !step1Valid) ||
                (step === 2 && !step2Valid) ||
                (step === 3 && !step3Valid)
              }
              className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-sky-900/30 active:scale-[0.98]"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!step4Valid || loading}
              className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-sky-900/30 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Starting...
                </span>
              ) : (
                "Let's Trade ⚡"
              )}
            </button>
          )}
        </div>

        {/* Step indicator dots */}
        <div className="flex justify-center gap-2 mt-5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i + 1 === step
                  ? 'w-5 h-2 bg-sky-500'
                  : i + 1 < step
                  ? 'w-2 h-2 bg-sky-700'
                  : 'w-2 h-2 bg-zinc-700'
              }`}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
