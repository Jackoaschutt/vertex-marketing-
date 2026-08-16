'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { completedCount, STAGES, stepId, TOTAL_STEPS } from '@/lib/learn'
import { Button, Card, Empty, Skeleton } from '@/components/ui'

export default function LearnPage() {
  const { data, ready, toggleCheck, addNote, removeNote } = useStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<'lesson' | 'idea' | 'note'>('lesson')
  const [open, setOpen] = useState<string | null>(null)

  if (!ready) return <Skeleton />

  const done = completedCount(data.checklist)

  function saveNote(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    addNote({ title: title.trim(), body: body.trim(), kind })
    setTitle('')
    setBody('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          The process, and what you make of it. Every step says why it exists — that reasoning is
          the part worth keeping.
        </p>
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-ink-700">
            {done} of {TOTAL_STEPS} steps
          </p>
          <p className="text-xs text-ink-500">{Math.round((done / TOTAL_STEPS) * 100)}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-moss-500 transition-all"
            style={{ width: `${(done / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </Card>

      {STAGES.map((stage) => {
        const stageDone = stage.steps.filter((s) => data.checklist[stepId(stage.key, s.key)]).length
        return (
          <Card key={stage.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="font-medium text-ink-900">{stage.title}</h2>
              <span className="shrink-0 text-xs tabular-nums text-ink-500">
                {stageDone}/{stage.steps.length}
              </span>
            </div>
            <p className="mb-4 text-sm text-ink-600">{stage.blurb}</p>

            <ul className="space-y-1">
              {stage.steps.map((step) => {
                const id = stepId(stage.key, step.key)
                const checked = Boolean(data.checklist[id])
                const expanded = open === id
                return (
                  <li key={id} className="rounded-xl border border-ink-100">
                    <div className="flex items-start gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCheck(id)}
                        id={id}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-moss-600"
                      />
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={id}
                          className={`block text-sm leading-snug ${
                            checked ? 'text-ink-400 line-through' : 'text-ink-900'
                          }`}
                        >
                          {step.label}
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : id)}
                          className="mt-1 text-xs text-ink-500 underline underline-offset-2"
                        >
                          {expanded ? 'Hide why' : 'Why this matters'}
                        </button>
                        {expanded && (
                          <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.why}</p>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}

      <Card title="Your notes">
        <form onSubmit={saveNote} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Killing a test late costs more than killing it early"
            maxLength={150}
            required
            className="h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="What happened, and what you took from it"
            className="w-full rounded-xl border border-ink-300 bg-white p-3 text-base leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(['lesson', 'idea', 'note'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`min-h-10 rounded-full px-3.5 text-sm capitalize transition ${
                  kind === k ? 'bg-ink-900 text-sand-50' : 'border border-ink-300 text-ink-700'
                }`}
              >
                {k}
              </button>
            ))}
            <Button type="submit">Save</Button>
          </div>
        </form>

        <div className="mt-5">
          {data.notes.length === 0 ? (
            <Empty
              title="Nothing written yet"
              body="Start with one thing you got wrong recently and what you would do differently. That single note is worth more than another video."
            />
          ) : (
            <ul className="space-y-3">
              {data.notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-ink-200 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">{n.title}</p>
                      {n.body && (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs uppercase tracking-wide text-ink-400">
                        {n.kind} · {new Date(n.createdAt).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <button
                      onClick={() => removeNote(n.id)}
                      aria-label={`Delete ${n.title}`}
                      className="shrink-0 rounded-full px-2 py-1 text-xs text-ink-400 hover:text-clay-600"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
