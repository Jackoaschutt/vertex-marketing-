'use client'

import { useEffect, useState } from 'react'

interface Props {
  sessionId: string
  onSessionEnded: () => void
}

const LOCKOUT_SECONDS = 15 * 60 // 15 minutes

export default function LockoutScreen({ sessionId, onSessionEnded }: Props) {
  const [remaining, setRemaining] = useState(LOCKOUT_SECONDS)
  const [posted, setPosted] = useState(false)

  // Post circuit breaker event on mount
  useEffect(() => {
    if (posted) return
    setPosted(true)
    fetch('/api/circuit-breaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        threshold_pct: 80,
        q1_response: null,
        q2_response: null,
        q3_response: null,
        action_taken: null,
      }),
    })
  }, [sessionId, posted])

  // Block all keyboard dismissal attempts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  // Countdown timer
  useEffect(() => {
    if (remaining <= 0) return
    const timer = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [remaining])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const locked = remaining > 0

  async function handleEndSession() {
    // Record action taken
    await fetch('/api/circuit-breaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        threshold_pct: 80,
        q1_response: null,
        q2_response: null,
        q3_response: null,
        action_taken: 'ended_session',
      }),
    })
    onSessionEnded()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/[0.98]">
      <div className="flex flex-col items-center gap-8 text-center px-6 max-w-lg w-full">
        {/* Lock icon */}
        <span className="text-8xl select-none">🔒</span>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-red-500 text-3xl font-bold tracking-widest uppercase">
            Hard Lockout
          </h1>
          <p className="text-zinc-300 text-lg font-semibold">80% Daily Loss Limit Reached</p>
        </div>

        {locked ? (
          <>
            {/* Timer */}
            <div className="flex flex-col items-center gap-3">
              <span className="font-mono text-7xl text-white tabular-nums tracking-tight">
                {timeStr}
              </span>
              <p className="text-zinc-400 text-sm">Time remaining in lockout</p>
            </div>

            {/* Messages */}
            <div className="flex flex-col gap-3">
              <p className="text-zinc-200 text-xl font-semibold">
                Step away from the screen.
              </p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Your session has been suspended. Return after the timer expires.
              </p>
            </div>

            {/* No buttons during countdown */}
          </>
        ) : (
          <>
            {/* Post-lockout */}
            <div className="flex flex-col gap-4">
              <p className="text-zinc-200 text-xl font-semibold">
                {"Time's up. Your session is now over."}
              </p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Losses beyond 80% of your daily limit are account-destroying.
                Take the rest of the day off.
              </p>
            </div>

            <button
              onClick={handleEndSession}
              className="w-full max-w-xs py-4 rounded-xl text-base font-bold bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              End Session
            </button>
          </>
        )}
      </div>
    </div>
  )
}
