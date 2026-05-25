'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Session, Trade, CircuitBreakerEvent } from '@/types'

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

type FollowedPlan    = 'Yes' | 'Partially' | 'No'
type RulesBroken     = 'No' | 'Yes'
type TradeTomorrow   = 'Yes' | 'No'

function scoreColor(s: number) {
  return s >= 80 ? C.green : s >= 50 ? C.amber : C.red
}

function formatDuration(start: string, end: string | null): string {
  const ms = ((end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime())
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function ScoreRing({ score }: { score: number }) {
  const col   = scoreColor(score)
  const r     = 30
  const circ  = 2 * Math.PI * r
  const dash  = (score / 100) * circ
  return (
    <svg width="72" height="72" style={{ flexShrink: 0 }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke={C.border} strokeWidth={5} />
      <circle cx="36" cy="36" r={r} fill="none" stroke={col} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill={col} fontSize="15" fontWeight="700" fontFamily="monospace">{score}</text>
    </svg>
  )
}

function AiReviewText({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
      {text.split('\n').map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} style={{ color: C.accent, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 14 }}>{line.replace(/\*\*/g, '')}</p>
        }
        if (!line.trim()) return <div key={i} style={{ height: 4 }} />
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

export default function DebriefPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [session, setSession]     = useState<Session | null>(null)
  const [trades, setTrades]       = useState<Trade[]>([])
  const [cbEvents, setCbEvents]   = useState<CircuitBreakerEvent[]>([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const [followedPlan, setFollowedPlan]   = useState<FollowedPlan | null>(null)
  const [rulesBroken, setRulesBroken]     = useState<RulesBroken | null>(null)
  const [execQuality, setExecQuality]     = useState(7)
  const [mistake, setMistake]             = useState('')
  const [sessionPnl, setSessionPnl]       = useState('')
  const [tomorrow, setTomorrow]           = useState<TradeTomorrow | null>(null)

  const [aiReview, setAiReview]   = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/sessions/${id}`)
      .then(r => r.json())
      .then(({ session: s, trades: t, cbEvents: cb }) => {
        setSession(s)
        setTrades(t ?? [])
        setCbEvents(cb ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const totalPnl   = trades.reduce((sum, t) => sum + t.pnl, 0)
  const canSubmit  = followedPlan !== null && rulesBroken !== null && tomorrow !== null

  // Live score
  const score = (() => {
    let s = 100
    if (followedPlan === 'No')        s -= 20
    if (followedPlan === 'Partially') s -= 10
    if (rulesBroken === 'Yes')        s -= 25
    if (execQuality < 5)              s -= 10
    cbEvents.forEach(() => { s -= 5 })
    return Math.max(0, s)
  })()

  async function getAiReview() {
    setAiLoading(true)
    setAiError(null)
    try {
      const res  = await fetch(`/api/sessions/${id}/ai-review`, { method: 'POST' })
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
            followed_rules:   followedPlan === 'Yes' ? 'yes' : followedPlan === 'Partially' ? 'mostly' : 'no',
            emotional_rating: execQuality,
            notes:            mistake,
            will_trade_tomorrow: tomorrow === 'Yes',
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
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: `${C.border} ${C.border} ${C.border} ${C.accent}` }} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: C.sub, fontSize: 14 }}>Session not found.</p>
      </div>
    )
  }

  const sx = session as Session & { game_plan?: string }
  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...style }}>{children}</div>
  )

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', paddingBottom: 40, color: C.text }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.accent, marginBottom: 4 }}>Post-Session</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>Session Debrief</h1>
        <p style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>Honest review locks in the learning — required before next session</p>
      </div>

      {/* Live Score */}
      <Card style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
        <ScoreRing score={score} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Session Score</p>
          <p style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>Process-based only · not P&L · updates live</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11 }}>
            <span style={{ color: C.green }}>80–100 Elite</span>
            <span style={{ color: C.amber }}>50–79 Good</span>
            <span style={{ color: C.red }}>0–49 Review</span>
          </div>
        </div>
      </Card>

      {/* Session Summary */}
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: C.sub, marginBottom: 14 }}>Session Summary</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Total P&L', val: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, col: totalPnl >= 0 ? C.green : C.red },
            { label: 'Trades',    val: String(trades.length), col: undefined },
            { label: 'CB Events', val: String(cbEvents.length), col: cbEvents.length > 0 ? C.amber : undefined },
            { label: 'Duration',  val: formatDuration(session.start_time, session.end_time), col: undefined },
          ].map(stat => (
            <div key={stat.label}>
              <p style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{stat.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: stat.col ?? C.text }}>{stat.val}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Game plan recap */}
      {sx.game_plan && (
        <Card style={{ marginBottom: 14, background: `${C.accent}08`, borderColor: `${C.accent}25` }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: C.sub, marginBottom: 8 }}>Your Pre-Session Game Plan</p>
          <p style={{ fontSize: 13, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.6 }}>&ldquo;{sx.game_plan}&rdquo;</p>
        </Card>
      )}

      {/* AI Review */}
      <Card style={{ marginBottom: 14, borderColor: `${C.accent}30` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: `${C.accent}18`, border: `1px solid ${C.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8" /><rect x="2" y="2" width="20" height="8" rx="2" /><path d="M22 14H2M22 18H2M22 22H2" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>AI Session Review</p>
            <p style={{ fontSize: 11, color: C.sub }}>Compares your game plan vs actual execution</p>
          </div>
        </div>

        {!aiReview && !aiLoading && (
          <div>
            {!sx.game_plan && (
              <p style={{ fontSize: 11, color: C.amber, background: `${C.amber}12`, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                No game plan was written — start sessions with a plan for better AI analysis.
              </p>
            )}
            <button onClick={getAiReview}
              style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: `${C.accent}15`, border: `1px solid ${C.accent}30`, color: C.accent, cursor: 'pointer' }}>
              Get AI Review →
            </button>
            {aiError && <p style={{ fontSize: 11, color: C.red, marginTop: 8, textAlign: 'center' }}>{aiError}</p>}
          </div>
        )}

        {aiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 0' }}>
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${C.border} ${C.border} ${C.border} ${C.accent}` }} />
            <p style={{ fontSize: 13, color: C.sub }}>Analyzing your session…</p>
          </div>
        )}

        {aiReview && (
          <div>
            <AiReviewText text={aiReview} />
            <button onClick={() => setAiReview(null)} style={{ fontSize: 11, color: C.sub, marginTop: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
              Regenerate
            </button>
          </div>
        )}
      </Card>

      {/* Debrief Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Q1: Followed plan? */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 11 }}>Did you follow your pre-session plan?</p>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['Yes', 'Partially', 'No'] as FollowedPlan[]).map(opt => {
              const col = opt === 'Yes' ? C.green : opt === 'No' ? C.red : C.amber
              const active = followedPlan === opt
              return (
                <button key={opt} type="button" onClick={() => setFollowedPlan(opt)}
                  style={{ flex: 1, padding: '9px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: `1px solid ${active ? col : C.border}`, background: active ? `${col}18` : 'transparent', color: active ? col : C.sub, transition: 'all 0.15s' }}>
                  {opt}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Q2: Rules broken? */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 11 }}>Did you break any trading rules?</p>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['No', 'Yes'] as RulesBroken[]).map(opt => {
              const col = opt === 'No' ? C.green : C.red
              const active = rulesBroken === opt
              return (
                <button key={opt} type="button" onClick={() => setRulesBroken(opt)}
                  style={{ flex: 1, padding: '9px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: `1px solid ${active ? col : C.border}`, background: active ? `${col}18` : 'transparent', color: active ? col : C.sub, transition: 'all 0.15s' }}>
                  {opt}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Q3: Execution quality */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 11 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Execution quality</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.accent }}>{execQuality}/10</span>
          </div>
          <input type="range" min={1} max={10} value={execQuality}
            onChange={e => setExecQuality(+e.target.value)}
            style={{ width: '100%', accentColor: C.accent, cursor: 'pointer' }}
          />
        </Card>

        {/* Q4: Biggest mistake */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 9 }}>
            Biggest mistake this session{' '}
            <span style={{ color: C.sub, fontSize: 11 }}>(required, even on green days)</span>
          </p>
          <textarea
            placeholder="Be honest. What could you have done better?"
            value={mistake} onChange={e => setMistake(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '10px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.6, resize: 'none', outline: 'none' }}
          />
        </Card>

        {/* Q5: Session P&L */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 9 }}>Session P&L</p>
          <input
            placeholder="+420 or -280"
            value={sessionPnl} onChange={e => setSessionPnl(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 20, fontFamily: 'monospace', fontWeight: 700, outline: 'none', letterSpacing: '0.5px' }}
          />
          <p style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>Confirm your actual P&L for the record</p>
        </Card>

        {/* Q6: Trade tomorrow? */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 11 }}>Would you trade again tomorrow at this emotional state?</p>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['Yes', 'No'] as TradeTomorrow[]).map(opt => {
              const col = opt === 'Yes' ? C.green : C.amber
              const active = tomorrow === opt
              return (
                <button key={opt} type="button" onClick={() => setTomorrow(opt)}
                  style={{ flex: 1, padding: '9px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: `1px solid ${active ? col : C.border}`, background: active ? `${col}18` : 'transparent', color: active ? col : C.sub, transition: 'all 0.15s' }}>
                  {opt}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Double-red warning */}
        {followedPlan === 'No' && rulesBroken === 'Yes' && (
          <div style={{ padding: '12px 16px', borderRadius: 8, fontSize: 12, color: C.red, background: `${C.red}12`, border: `1px solid ${C.red}35` }}>
            ⚠️ Double-red session flagged: Plan ignored + rules broken. Review required before next session.
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, color: C.red, background: `${C.red}12`, border: `1px solid ${C.red}35` }}>{error}</div>
        )}

        <button type="submit" disabled={!canSubmit || submitting}
          style={{ width: '100%', padding: '14px', borderRadius: 10, background: canSubmit ? C.accent : C.border, color: canSubmit ? '#000' : C.sub, fontWeight: 700, fontSize: 14, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed', marginTop: 4, opacity: !canSubmit ? 0.5 : 1 }}>
          {submitting ? 'Saving…' : 'Submit Debrief & Close Session'}
        </button>
      </form>
    </div>
  )
}
