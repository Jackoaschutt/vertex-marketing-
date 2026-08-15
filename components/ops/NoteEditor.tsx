'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const KINDS = [
  ['lesson', 'Lesson — something you got right or wrong'],
  ['note', 'Note — an observation'],
  ['idea', 'Idea — something to try'],
  ['source', 'Source — where you found something'],
] as const

export function NoteEditor({ products }: { products: { id: string; name: string }[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const el = e.currentTarget
    const form = new FormData(el)

    try {
      const res = await fetch('/api/commerce/learning/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          body: form.get('body') || '',
          kind: form.get('kind'),
          productId: form.get('productId') || '',
          tags: form.get('tags') || '',
          pinned: form.get('pinned') === 'on',
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
      setMessage({ tone: 'ok', text: 'Saved to the playbook.' })
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
      <label className="block">
        <span className="block text-xs font-medium text-ink-700">Title</span>
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Killing a test late costs more than killing it early"
          className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
        />
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-ink-700">What happened, and what you took from it</span>
        <textarea
          name="body"
          rows={5}
          maxLength={20000}
          className="mt-1 w-full rounded-xl border border-ink-300 bg-white p-3 text-sm leading-relaxed text-ink-900"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Kind</span>
          <select
            name="kind"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            {KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Product (optional)</span>
          <select
            name="productId"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            <option value="">Not about one product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Tags</span>
          <input
            name="tags"
            maxLength={300}
            placeholder="creative, pricing"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-sm font-medium text-sand-100 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-700">
          <input name="pinned" type="checkbox" className="h-4 w-4" />
          Pin to the top
        </label>
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
