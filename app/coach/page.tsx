'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { ask, SUGGESTIONS, type Answer } from '@/lib/coach'
import { Button, Card, Note, Skeleton } from '@/components/ui'

export default function CoachPage() {
  const { data, ready } = useStore()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [asked, setAsked] = useState('')

  if (!ready) return <Skeleton />

  function run(q: string) {
    if (!q.trim()) return
    setAsked(q)
    setAnswer(ask(q, data))
    setQuestion('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coach</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          Answers worked out from what you have entered — nothing else. It will tell you when you
          have not recorded enough rather than making a number up.
        </p>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(question)
          }}
          className="space-y-3"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your money or your progress"
            className="h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
          />
          <Button type="submit">Ask</Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => run(s)}
              className="min-h-10 rounded-full border border-ink-300 px-3.5 text-sm text-ink-700 transition hover:border-ink-900"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {answer && (
        <Card>
          <p className="text-xs uppercase tracking-wider text-ink-400">{asked}</p>
          <p className="mt-2 text-lg leading-snug text-ink-900">{answer.headline}</p>
          {answer.points.length > 0 && (
            <ul className="mt-4 space-y-2">
              {answer.points.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
          {answer.caveats.length > 0 && (
            <div className="mt-4 space-y-2">
              {answer.caveats.map((c, i) => (
                <Note key={i} tone="warn">
                  {c}
                </Note>
              ))}
            </div>
          )}
        </Card>
      )}

      <p className="px-1 text-xs leading-relaxed text-ink-500">
        This runs entirely on your device. Nothing you type here is sent anywhere.
      </p>
    </div>
  )
}
