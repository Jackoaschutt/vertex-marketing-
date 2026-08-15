'use client'

import { useState } from 'react'

interface Answer {
  answer: string
  bullets: string[]
  caveats: string[]
  generator: 'anthropic' | 'rules'
  model: string | null
}

export function AnalystPanel({ suggestions }: { suggestions: string[] }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(q: string) {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch('/api/commerce/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'The analyst could not answer.')
        return
      }
      setAnswer(data)
    } catch {
      setError('Could not reach the analyst endpoint.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run(question)
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="analyst-q" className="sr-only">
          Ask a question about the business
        </label>
        <input
          id="analyst-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What is my most profitable product?"
          maxLength={500}
          className="min-h-11 flex-1 rounded-full border border-ink-300 bg-white px-4 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-ink-900"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="min-h-11 shrink-0 rounded-full bg-ink-900 px-5 text-sm font-medium text-sand-100 transition hover:bg-ink-800 disabled:bg-ink-300"
        >
          {loading ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      <div className="commerce-rail mt-3 flex gap-2 overflow-x-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuestion(s)
              void run(s)
            }}
            className="shrink-0 rounded-full border border-ink-200 px-3 py-1.5 text-xs text-ink-600 transition hover:border-ink-900 hover:text-ink-900"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-clay-500/40 bg-clay-400/10 p-3 text-sm text-clay-600">
          {error}
        </p>
      )}

      {answer && (
        <div className="mt-5 rounded-2xl border border-ink-200 bg-sand-50 p-5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider ${
                answer.generator === 'anthropic'
                  ? 'border-moss-400/40 bg-moss-400/15 text-moss-500'
                  : 'border-clay-400/40 bg-clay-400/15 text-clay-600'
              }`}
            >
              {answer.generator === 'anthropic' ? `model: ${answer.model}` : 'rules engine'}
            </span>
            <span className="text-xs text-ink-500">Computed from live database figures</span>
          </div>

          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-900">{answer.answer}</p>

          {answer.bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
              {answer.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-ink-400">
                    —
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {answer.caveats.length > 0 && (
            <div className="mt-4 border-t border-ink-200 pt-3">
              <p className="commerce-eyebrow text-ink-500">Caveats</p>
              <ul className="mt-1.5 space-y-1 text-xs text-ink-500">
                {answer.caveats.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
