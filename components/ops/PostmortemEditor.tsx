'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface FactorOption {
  key: string
  label: string
  polarity: 'positive' | 'negative' | 'neutral'
}

const PROMPTS = {
  whatHappened: 'What did you set out to do, and what actually happened?',
  whatWorked: 'What worked, even if the overall result was bad?',
  whatFailed: 'What failed, and at what point did you know?',
  nextTime: 'What will you do differently on the next one?',
}

export function PostmortemEditor({
  products,
  factors,
}: {
  products: { id: string; name: string; status: string }[]
  factors: FactorOption[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/commerce/learning/postmortem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.get('productId'),
          outcome: form.get('outcome'),
          whatHappened: form.get('whatHappened') || '',
          whatWorked: form.get('whatWorked') || '',
          whatFailed: form.get('whatFailed') || '',
          nextTime: form.get('nextTime') || '',
          factors: selected.join(','),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({
          tone: 'err',
          text:
            Array.isArray(data.issues) && data.issues.length ? data.issues.join(' ') : data.error,
        })
        return
      }
      setMessage({ tone: 'ok', text: 'Written, with the figures snapshotted as they stand now.' })
      setSelected([])
      router.refresh()
    } catch {
      setMessage({ tone: 'err', text: 'Could not reach the server. Nothing was saved.' })
    } finally {
      setBusy(false)
    }
  }

  const group = (polarity: FactorOption['polarity']) => factors.filter((f) => f.polarity === polarity)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Product</span>
          <select
            name="productId"
            required
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Outcome</span>
          <select
            name="outcome"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            <option value="loser">Loser</option>
            <option value="winner">Winner</option>
            <option value="undecided">Undecided</option>
          </select>
        </label>
      </div>

      {(Object.keys(PROMPTS) as (keyof typeof PROMPTS)[]).map((field) => (
        <label key={field} className="block">
          <span className="block text-xs font-medium text-ink-700">{PROMPTS[field]}</span>
          <textarea
            name={field}
            rows={3}
            maxLength={5000}
            className="mt-1 w-full rounded-xl border border-ink-300 bg-white p-3 text-sm leading-relaxed text-ink-900"
          />
        </label>
      ))}

      <div>
        <p className="text-xs font-medium text-ink-700">
          What caused it? Pick every one that applies — these are what get counted across products.
        </p>
        <div className="mt-3 space-y-3">
          {(['positive', 'negative', 'neutral'] as const).map((polarity) => (
            <div key={polarity}>
              <p className="text-[0.7rem] uppercase tracking-wider text-ink-500">
                {polarity === 'positive' ? 'Went right' : polarity === 'negative' ? 'Went wrong' : 'Other'}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {group(polarity).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggle(f.key)}
                    className={`min-h-9 rounded-full border px-3 text-xs transition ${
                      selected.includes(f.key)
                        ? 'border-ink-900 bg-ink-900 text-sand-100'
                        : 'border-ink-300 text-ink-700 hover:border-ink-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-sm font-medium text-sand-100 disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Write it'}
      </button>

      {message && (
        <p
          className={`rounded-xl border p-3 text-sm ${
            message.tone === 'ok'
              ? 'border-moss-400/40 bg-moss-400/10 text-moss-500'
              : 'border-danger-500/40 bg-danger-500/10 text-danger-600'
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  )
}
