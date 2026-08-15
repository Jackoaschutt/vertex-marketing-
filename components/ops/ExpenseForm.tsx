'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const CATEGORIES = [
  ['software', 'Software / subscriptions'],
  ['samples', 'Product samples'],
  ['shipping', 'Shipping supplies'],
  ['learning', 'Courses / learning'],
  ['fees', 'Bank and platform fees'],
  ['contractor', 'Contractors / freelancers'],
  ['other', 'Other'],
] as const

export function ExpenseForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const form = new FormData(e.currentTarget)
    const el = e.currentTarget

    try {
      const res = await fetch('/api/commerce/books/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.get('label'),
          category: form.get('category'),
          amountCents: Math.round(
            (Number(String(form.get('amount') ?? '').replace(/[^0-9.]/g, '')) || 0) * 100
          ),
          day: form.get('day'),
          recurring: form.get('recurring') === 'on',
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
      setMessage({ tone: 'ok', text: 'Recorded against net profit.' })
      el.reset()
      router.refresh()
    } catch {
      setMessage({ tone: 'err', text: 'Could not reach the server. Nothing was saved.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="block text-xs font-medium text-ink-700">What was it</span>
          <input
            name="label"
            required
            maxLength={120}
            placeholder="Shopify subscription"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Category</span>
          <select
            name="category"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Amount</span>
          <input
            name="amount"
            inputMode="decimal"
            required
            placeholder="0.00"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Day</span>
          <input
            name="day"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 h-11 rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-700">
          <input name="recurring" type="checkbox" className="h-4 w-4" />
          Recurring
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-full border border-ink-900 px-5 text-sm text-ink-900 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Add expense'}
        </button>
      </div>
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
