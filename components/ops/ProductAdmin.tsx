'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ProductStatus } from '@/lib/commerce/types'

interface Props {
  productId: string
  name: string
  status: ProductStatus
  published: boolean
  allowedStatuses: ProductStatus[]
  sellable: boolean
  ordersCount: number
}

/** Row-level admin actions: status transition, publish toggle, AI copy, delete. */
export function ProductAdmin({
  productId,
  name,
  status,
  published,
  allowedStatuses,
  sellable,
  ordersCount,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label)
    setMessage(null)
    try {
      const res = await fetch(`/api/commerce/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({
          tone: 'err',
          text: Array.isArray(data.issues) && data.issues.length ? data.issues.join(' ') : data.error,
        })
        return
      }
      setMessage({ tone: 'ok', text: 'Saved.' })
      router.refresh()
    } catch {
      setMessage({ tone: 'err', text: 'Request failed.' })
    } finally {
      setBusy(null)
    }
  }

  async function generate() {
    setBusy('content')
    setMessage(null)
    try {
      const res = await fetch('/api/commerce/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, save: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ tone: 'err', text: data.error ?? 'Generation failed.' })
        return
      }
      const issues = (data.guardrailIssues ?? []).length
      setMessage({
        tone: 'ok',
        text: `Generated via ${data.generator}${data.model ? ` (${data.model})` : ''}${
          issues ? ` — ${issues} unsupportable claim(s) stripped` : ''
        }. Saved unapproved.`,
      })
      router.refresh()
    } catch {
      setMessage({ tone: 'err', text: 'Request failed.' })
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setBusy('delete')
    try {
      const res = await fetch(`/api/commerce/products/${productId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ tone: 'err', text: data.error })
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'min-h-9 rounded-full border border-ink-300 px-3 text-xs text-ink-700 transition hover:border-ink-900 disabled:opacity-40'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {allowedStatuses.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy !== null}
            onClick={() => patch({ status: s }, s)}
            className={btn}
            title={`Move from ${status} to ${s}`}
          >
            {busy === s ? '…' : `→ ${s}`}
          </button>
        ))}

        <button
          type="button"
          disabled={busy !== null || (!published && !sellable)}
          onClick={() => patch({ published: !published }, 'publish')}
          className={`min-h-9 rounded-full px-3 text-xs transition disabled:opacity-40 ${
            published
              ? 'border border-ink-300 text-ink-700 hover:border-ink-900'
              : 'bg-ink-900 text-sand-100 hover:bg-ink-800'
          }`}
          title={
            !published && !sellable
              ? 'Only approved, testing, winner or scaling products can be published.'
              : undefined
          }
        >
          {busy === 'publish' ? '…' : published ? 'Unpublish' : 'Publish'}
        </button>

        <button type="button" disabled={busy !== null} onClick={generate} className={btn}>
          {busy === 'content' ? 'Generating…' : 'Generate copy'}
        </button>

        <button
          type="button"
          disabled={busy !== null || ordersCount > 0}
          onClick={remove}
          className="min-h-9 rounded-full border border-danger-500/40 px-3 text-xs text-danger-600 transition hover:bg-danger-500/10 disabled:opacity-30"
          title={ordersCount > 0 ? 'Products with orders cannot be deleted — unpublish instead.' : undefined}
        >
          {busy === 'delete' ? '…' : 'Delete'}
        </button>
      </div>

      {message && (
        <p className={`text-xs ${message.tone === 'ok' ? 'text-moss-500' : 'text-clay-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
