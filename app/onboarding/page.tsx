'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PropFirmRule } from '@/types'

const TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'other', label: 'Other (type below)' },
]

/** Try to parse a dollar amount from a firm name, e.g. "Apex 50K" → 50000 */
function parseBalanceFromName(name: string): string {
  const match = name.match(/(\d+)\s*[kK]/)
  if (match) return String(parseInt(match[1]) * 1000)
  const match2 = name.match(/(\d+)\s*[mM]/)
  if (match2) return String(parseInt(match2[1]) * 1_000_000)
  return ''
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [userId, setUserId] = useState<string | null>(null)

  // Step 1 state
  const [timezone, setTimezone] = useState('Australia/Sydney')
  const [customTimezone, setCustomTimezone] = useState('')

  // Step 2 state
  const [firms, setFirms] = useState<PropFirmRule[]>([])
  const [firmId, setFirmId] = useState('')
  const [nickname, setNickname] = useState('')
  const [startingBalance, setStartingBalance] = useState('')

  // UI state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Auth check on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
      } else {
        setUserId(data.user.id)
      }
    })
  }, [router])

  // Fetch firms when reaching step 2
  useEffect(() => {
    if (step !== 2) return
    const supabase = createClient()
    supabase
      .from('prop_firm_rules')
      .select('id, name, dll_amount, max_drawdown, profit_target, drawdown_type, min_trading_days, reset_time, reset_timezone, is_custom')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setFirms(data as PropFirmRule[])
          if (data.length > 0 && !firmId) {
            setFirmId(data[0].id)
            setStartingBalance(parseBalanceFromName(data[0].name))
          }
        }
      })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill balance when firm changes
  function handleFirmChange(id: string) {
    setFirmId(id)
    const firm = firms.find((f) => f.id === id)
    if (firm) setStartingBalance(parseBalanceFromName(firm.name))
  }

  const effectiveTimezone = timezone === 'other' ? customTimezone : timezone

  async function handleCompleteStep2() {
    if (!userId) return
    setSaving(true)
    setSaveError(null)

    const supabase = createClient()

    const [tzResult, acctResult] = await Promise.all([
      supabase
        .from('traders')
        .update({ timezone: effectiveTimezone })
        .eq('id', userId),
      supabase.from('prop_accounts').insert({
        trader_id: userId,
        firm_id: firmId || null,
        nickname: nickname.trim(),
        starting_balance: parseFloat(startingBalance) || 0,
        current_balance: parseFloat(startingBalance) || 0,
      }),
    ])

    if (tzResult.error || acctResult.error) {
      setSaveError(tzResult.error?.message ?? acctResult.error?.message ?? 'Something went wrong. Please try again.')
      setSaving(false)
      return
    }

    setSaving(false)
    setStep(3)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-3xl font-bold text-sky-500 tracking-tight">PropGuard</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-xl p-8">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`block rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-6 h-2.5 bg-sky-500'
                  : s < step
                  ? 'w-2.5 h-2.5 bg-sky-700'
                  : 'w-2.5 h-2.5 bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Welcome to PropGuard</h1>
              <p className="mt-1 text-zinc-400 text-sm">Let&apos;s set up your account in 2 minutes</p>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-zinc-400 mb-1.5">
                Your timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {timezone === 'other' && (
              <div>
                <label htmlFor="customTimezone" className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Enter timezone (e.g. America/Denver)
                </label>
                <input
                  id="customTimezone"
                  type="text"
                  value={customTimezone}
                  onChange={(e) => setCustomTimezone(e.target.value)}
                  placeholder="America/Denver"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                />
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={timezone === 'other' && !customTimezone.trim()}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 transition"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2 — Add first prop account */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Add your first prop account</h1>
              <p className="mt-1 text-zinc-400 text-sm">
                You can add more accounts from the dashboard
              </p>
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-zinc-400 mb-1.5">
                Account nickname
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Apex 50K Main"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="firm" className="block text-sm font-medium text-zinc-400 mb-1.5">
                Prop firm
              </label>
              {firms.length === 0 ? (
                <div className="flex items-center gap-2 text-zinc-500 text-sm py-2.5">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading firms…
                </div>
              ) : (
                <select
                  id="firm"
                  value={firmId}
                  onChange={(e) => handleFirmChange(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                >
                  {firms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="balance" className="block text-sm font-medium text-zinc-400 mb-1.5">
                Starting balance ($)
              </label>
              <input
                id="balance"
                type="number"
                min="0"
                step="1"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                placeholder="50000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>

            {saveError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
                {saveError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-lg px-4 py-2.5 transition"
              >
                Back
              </button>
              <button
                onClick={handleCompleteStep2}
                disabled={saving || !nickname.trim() || !firmId || !startingBalance}
                className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 transition"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  'Next'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — All set */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            {/* Check icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-sky-500/15 flex items-center justify-center">
                <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white">You&apos;re ready to trade with discipline</h1>
              <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
                We&apos;ll stop you before emotions override your rules.
              </p>
            </div>

            {/* Promise bullets */}
            <div className="text-left space-y-3 bg-zinc-800/50 rounded-lg p-4">
              {[
                'Real-time circuit breakers at 50% & 80% daily loss limit',
                'Guided check-in before you can continue trading',
                'Analytics that reveal where your edge actually comes from',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-zinc-300">{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg px-4 py-2.5 transition"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
