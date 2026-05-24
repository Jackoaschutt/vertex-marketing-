'use client'

import { useEffect, useState } from 'react'

interface Props {
  sessionId: string
  pnl: number
  dllAmount: number
  onContinue: () => void
  onEndSession: () => void
}

export default function CircuitBreakerModal({
  sessionId,
  pnl,
  dllAmount,
  onContinue,
  onEndSession,
}: Props) {
  const [a1, setA1] = useState('')
  const [a2, setA2] = useState('')
  const [a3, setA3] = useState('')
  const [loading, setLoading] = useState(false)

  const allAnswered = a1.trim().length >= 3 && a2.trim().length >= 3 && a3.trim().length >= 3

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  async function recordEvent(action: 'continued' | 'ended_session') {
    await fetch('/api/circuit-breaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        threshold_pct: 50,
        q1_response: a1.trim(),
        q2_response: a2.trim(),
        q3_response: a3.trim(),
        action_taken: action,
      }),
    })
  }

  async function handleContinue() {
    if (!allAnswered) return
    setLoading(true)
    await recordEvent('continued')
    setLoading(false)
    onContinue()
  }

  async function handleEndSession() {
    setLoading(true)
    await recordEvent('ended_session')
    setLoading(false)
    onEndSession()
  }

  const lossPct = dllAmount > 0 ? ((Math.abs(pnl) / dllAmount) * 100).toFixed(1) : '0'

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-slate-900 border border-amber-600/70 rounded-2xl p-8 shadow-2xl flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-1">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-amber-400 text-xl font-bold tracking-widest uppercase">
            Circuit Breaker
          </h2>
          <p className="text-white font-semibold text-lg">50% Daily Loss Limit Reached</p>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="text-red-400 font-mono font-bold text-xl">
              -${Math.abs(pnl).toFixed(2)}
            </span>
            <span className="text-slate-500">/ DLL</span>
            <span className="text-slate-300 font-mono">${dllAmount.toFixed(2)}</span>
            <span className="text-amber-500 font-semibold">({lossPct}%)</span>
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        <div className="flex flex-col gap-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
            You must answer all 3 questions to continue
          </p>

          <Question
            number={1}
            label="Why did you take that last trade?"
            value={a1}
            onChange={setA1}
          />
          <Question
            number={2}
            label="Are you trading your plan, or reacting emotionally?"
            value={a2}
            onChange={setA2}
          />
          <Question
            number={3}
            label="What will you do differently for the rest of this session?"
            value={a3}
            onChange={setA3}
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleContinue}
            disabled={!allAnswered || loading}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Continue Trading'}
          </button>
          <button
            onClick={handleEndSession}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors disabled:opacity-40"
          >
            End Session Now
          </button>
        </div>
      </div>
    </div>
  )
}

function Question({
  number,
  label,
  value,
  onChange,
}: {
  number: number
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const filled = value.trim().length >= 3
  return (
    <div>
      <label className="block text-sm text-slate-200 mb-2">
        <span className="text-amber-500 font-bold mr-1">{number}.</span>
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Write your answer here..."
        className={`w-full bg-slate-800 border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-600 resize-none transition-colors ${
          filled ? 'border-amber-600/60' : 'border-slate-700'
        }`}
      />
      {value.length > 0 && !filled && (
        <p className="text-[10px] text-slate-500 mt-1">At least 3 characters required</p>
      )}
    </div>
  )
}
