'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TradingSession } from '@/types'

const C = {
  bg:      '#09090f',
  surface: '#0f0f17',
  card:    '#14141e',
  border:  '#1e1e2e',
  accent:  '#06b6d4',
  green:   '#22c55e',
  red:     '#ef4444',
  amber:   '#f59e0b',
  text:    '#f1f5f9',
  sub:     '#64748b',
}

const SESSIONS: { value: TradingSession; label: string; emoji: string; time: string }[] = [
  { value: 'LONDON',   label: 'London Open',  emoji: '🇬🇧', time: '3–5am EST' },
  { value: 'NY_OPEN',  label: 'NY Open',      emoji: '🗽',  time: '9:30am EST' },
  { value: 'NY_CLOSE', label: 'NY Close',     emoji: '🌆',  time: '3–4pm EST' },
  { value: 'ASIA',     label: 'Asia',         emoji: '🏯',  time: '7pm–2am EST' },
  { value: 'OTHER',    label: 'Other',        emoji: '🌍',  time: 'Custom' },
]

const TOTAL = 6
const STEPS = ['Emotional State', 'Sleep Quality', 'Which Session', 'Approach', 'Session Plan', 'Confirm']

function emotionToState(val: number): string {
  if (val <= 3) return 'Frustrated'
  if (val <= 5) return 'Anxious'
  if (val <= 7) return 'Calm'
  return 'Focused'
}

function Slider({ val, onChange, low = 6 }: { val: number; onChange: (v: number) => void; low?: number }) {
  const col = val >= 7 ? C.green : val >= low ? C.amber : C.red
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: C.sub }}>1 — Terrible</span>
        <span style={{ fontSize: 40, fontWeight: 700, fontFamily: 'monospace', color: col }}>{val}</span>
        <span style={{ fontSize: 12, color: C.sub }}>10 — Perfect</span>
      </div>
      <input
        type="range" min={1} max={10} value={val}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: C.accent, height: 4, cursor: 'pointer' }}
      />
    </div>
  )
}

export default function NewSessionPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const accountId    = searchParams.get('account') ?? ''

  const [step, setStep] = useState(0)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [firmName, setFirmName]       = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [checkingActive, setCheckingActive]   = useState(true)

  const [emotion, setEmotion]           = useState(7)
  const [sleep, setSleep]               = useState(7)
  const [tradingSession, setTradingSession] = useState<TradingSession | ''>('')
  const [approach, setApproach]         = useState<'Clear Setup' | 'Looking for Action' | null>(null)
  const [biasReviewed, setBiasReviewed] = useState<boolean | null>(null)
  const [withinRisk, setWithinRisk]     = useState<boolean | null>(null)
  const [plan, setPlan]                 = useState('')
  const [confirmed, setConfirmed]       = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!accountId) return
    const { createClient } = require('@/lib/supabase/client')
    const supabase = createClient()
    supabase.from('prop_accounts').select('nickname, prop_firm_rules(name)').eq('id', accountId).single()
      .then(({ data }: { data: { nickname: string; prop_firm_rules: { name: string } | { name: string }[] } | null }) => {
        if (!data) return
        setAccountName(data.nickname)
        const r = data.prop_firm_rules
        if (Array.isArray(r) && r.length > 0) setFirmName(r[0].name)
        else if (r && !Array.isArray(r)) setFirmName(r.name)
      })

    fetch(`/api/sessions?account_id=${accountId}`)
      .then(r => r.json())
      .then(({ session }) => { if (session?.id) setActiveSessionId(session.id) })
      .finally(() => setCheckingActive(false))
  }, [accountId])

  const blocked  = emotion < 4
  const cautious = emotion < 6 && !blocked

  function canNext() {
    if (step === 2) return tradingSession !== ''
    if (step === 3) return approach !== null && biasReviewed !== null && withinRisk === true
    if (step === 4) return plan.trim().length >= 10
    if (step === 5) return confirmed
    return true
  }

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prop_account_id:    accountId,
          trading_session:    tradingSession || 'NY_OPEN',
          pre_emotional_state: emotionToState(emotion),
          has_setup:          approach === 'Clear Setup',
          game_plan:          plan.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409 && data.session?.id) {
          router.push(`/session/${data.session.id}`)
          return
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
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: `${C.border} ${C.border} ${C.border} ${C.accent}` }} />
      </div>
    )
  }

  if (activeSessionId) {
    return (
      <div className="flex items-center justify-center h-full py-12 px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}40` }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.accent} strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Session In Progress</h1>
          <p style={{ color: C.sub, marginBottom: 28 }}>You already have an active session running.</p>
          <button onClick={() => router.push(`/session/${activeSessionId}`)}
            style={{ width: '100%', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, background: C.accent, color: '#000', border: 'none', cursor: 'pointer' }}>
            Resume Session →
          </button>
          <button onClick={() => router.back()}
            style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, fontWeight: 500, fontSize: 13, background: 'transparent', color: C.sub, border: 'none', cursor: 'pointer' }}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: 540 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.accent, marginBottom: 4 }}>Pre-Session Gate</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>{accountName ?? 'Start Trading'}</h1>
          {firmName && <p style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{firmName}</p>}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.accent : C.border, transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Card */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Step {step + 1} of {TOTAL}</p>
          <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 22 }}>{STEPS[step]}</h2>

          {/* Step 0: Emotional State */}
          {step === 0 && (
            <div>
              <Slider val={emotion} onChange={setEmotion} />
              {blocked && (
                <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: 8, fontSize: 12, color: C.red, background: `${C.red}12`, border: `1px solid ${C.red}35` }}>
                  🔴 Critical — trading is not recommended today. Consider sitting out.
                </div>
              )}
              {cautious && (
                <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: 8, fontSize: 12, color: C.amber, background: `${C.amber}12`, border: `1px solid ${C.amber}35` }}>
                  ⚠️ Below threshold — proceed with caution and reduced size.
                </div>
              )}
            </div>
          )}

          {/* Step 1: Sleep Quality */}
          {step === 1 && <Slider val={sleep} onChange={setSleep} />}

          {/* Step 2: Trading Session */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SESSIONS.map(s => (
                <button key={s.value} onClick={() => setTradingSession(s.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: `2px solid ${tradingSession === s.value ? C.accent : C.border}`, background: tradingSession === s.value ? `${C.accent}12` : C.surface, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 22 }}>{s.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color: tradingSession === s.value ? C.accent : C.text }}>{s.label}</p>
                    <p style={{ fontSize: 11, color: C.sub }}>{s.time}</p>
                  </div>
                  {tradingSession === s.value && <span style={{ color: C.accent }}>✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Approach + Bias/Risk */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>Trading approach today</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['Clear Setup', 'Looking for Action'] as const).map(opt => (
                    <button key={opt} onClick={() => setApproach(opt)}
                      style={{ flex: 1, padding: '14px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: `2px solid ${approach === opt ? C.accent : C.border}`, background: approach === opt ? `${C.accent}12` : C.surface, color: approach === opt ? C.accent : C.sub, transition: 'all 0.15s' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {[
                { label: 'Have you reviewed your daily bias?', val: biasReviewed, set: setBiasReviewed },
                { label: 'Are you within your daily risk parameters?', val: withinRisk, set: setWithinRisk },
              ].map(item => (
                <div key={item.label} style={{ padding: '14px 16px', background: C.surface, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, flex: 1, marginRight: 12 }}>{item.label}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[true, false].map(opt => (
                      <button key={String(opt)} onClick={() => item.set(opt)}
                        style={{ padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${item.val === opt ? (opt ? C.green : C.red) : C.border}`, background: item.val === opt ? (opt ? `${C.green}18` : `${C.red}18`) : 'transparent', color: item.val === opt ? (opt ? C.green : C.red) : C.sub }}>
                        {opt ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {withinRisk === false && (
                <div style={{ padding: '11px 14px', borderRadius: 8, fontSize: 12, color: C.red, background: `${C.red}12`, border: `1px solid ${C.red}35` }}>
                  ⚠️ You must be within risk parameters before trading.
                </div>
              )}
            </div>
          )}

          {/* Step 4: Game Plan */}
          {step === 4 && (
            <div>
              <textarea
                placeholder="e.g. Wait for NY open, only take ICT OB setups on MNQ, max 2 trades, no revenge trading..."
                value={plan} onChange={e => setPlan(e.target.value)}
                rows={5}
                style={{ width: '100%', padding: '12px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', outline: 'none' }}
              />
              <p style={{ fontSize: 11, color: plan.trim().length >= 10 ? C.green : C.sub, marginTop: 5, textAlign: 'right' }}>
                {plan.trim().length} chars {plan.trim().length < 10 && '· min 10'}
              </p>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 5 && (
            <div>
              <div style={{ padding: 16, background: C.surface, borderRadius: 8, marginBottom: 14, fontSize: 13, lineHeight: 2, border: `1px solid ${C.border}` }}>
                <div>😊 Emotion: <strong>{emotion}/10</strong> &nbsp;·&nbsp; 😴 Sleep: <strong>{sleep}/10</strong></div>
                <div>📊 Session: <strong>{SESSIONS.find(s => s.value === tradingSession)?.label ?? '—'}</strong></div>
                <div>🎯 Approach: <strong>{approach ?? '—'}</strong></div>
                <div style={{ marginTop: 4, fontSize: 12, color: C.sub }}>{plan}</div>
              </div>
              {cautious && !blocked && (
                <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, color: C.amber, background: `${C.amber}12`, border: `1px solid ${C.amber}35`, marginBottom: 12 }}>
                  ⚠️ Below-threshold scores recorded — consider trading with reduced size.
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '14px 16px', background: C.surface, borderRadius: 8, border: `1px solid ${confirmed ? C.accent : C.border}` }}>
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ accentColor: C.accent, width: 15, height: 15 }} />
                <span style={{ fontSize: 13 }}>I will only take A+ setups today — no exceptions</span>
              </label>
              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 12, color: C.red, background: `${C.red}12`, border: `1px solid ${C.red}35` }}>{error}</div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}
              style={{ padding: '9px 18px', borderRadius: 7, background: 'transparent', border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: step === 0 ? 0.3 : 1 }}>
              ← Back
            </button>
            <button
              disabled={!canNext() || blocked || (step === 3 && withinRisk === false)}
              onClick={() => {
                if (step < TOTAL - 1) setStep(step + 1)
                else submit()
              }}
              style={{ padding: '9px 20px', borderRadius: 7, background: canNext() && !blocked ? C.accent : C.border, color: canNext() && !blocked ? '#000' : C.sub, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', opacity: (!canNext() || blocked) ? 0.5 : 1 }}>
              {step === TOTAL - 1
                ? loading ? 'Starting…' : '🔓 Unlock Session'
                : 'Continue →'}
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ borderRadius: 9999, transition: 'all 0.3s', width: i === step ? 20 : 8, height: 8, background: i === step ? C.accent : i < step ? `${C.accent}60` : C.border }} />
          ))}
        </div>
      </div>
    </div>
  )
}
