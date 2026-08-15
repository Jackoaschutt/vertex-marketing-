'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const CHANNELS = ['shopify', 'tiktok', 'amazon', 'etsy', 'ebay', 'own', 'other']

const money = (v: FormDataEntryValue | null) =>
  Math.round((Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0) * 100)

function Field({
  label,
  name,
  hint,
  ...rest
}: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700">{label}</span>
      <input
        name={name}
        {...rest}
        className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
      />
      {hint && <span className="mt-1 block text-[0.7rem] leading-snug text-ink-500">{hint}</span>}
    </label>
  )
}

/**
 * A day of sales, entered by hand.
 *
 * Defaults to yesterday rather than today, because a day is only complete once
 * it is over — entering today mid-afternoon and never coming back is how a
 * hand-kept ledger ends up permanently understating revenue.
 */
export function LedgerForm({
  products,
  lastChannel,
}: {
  products: { id: string; name: string }[]
  lastChannel?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/commerce/books/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: form.get('day'),
          productId: form.get('productId') || '',
          channel: form.get('channel'),
          units: Number(form.get('units') || 0),
          revenueCents: money(form.get('revenue')),
          cogsCents: money(form.get('cogs')),
          shippingCostCents: money(form.get('shipping')),
          feesCents: money(form.get('fees')),
          refundsCents: money(form.get('refunds')),
          refundUnits: Number(form.get('refundUnits') || 0),
          note: form.get('note') || '',
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
      setMessage({ tone: 'ok', text: 'Saved. Every figure on this page now includes it.' })
      router.refresh()
    } catch {
      setMessage({ tone: 'err', text: 'Could not reach the server. Nothing was saved.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Day" name="day" type="date" defaultValue={yesterday} required />
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Product</span>
          <select
            name="productId"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            <option value="">Not product-specific</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700">Channel</span>
          <select
            name="channel"
            defaultValue={lastChannel ?? 'shopify'}
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Units sold" name="units" type="number" min={0} defaultValue={0} />
        <Field label="Revenue" name="revenue" inputMode="decimal" placeholder="0.00" hint="What the customers paid, before any costs." />
        <Field label="Cost of goods" name="cogs" inputMode="decimal" placeholder="0.00" hint="What you paid the supplier for the units." />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Inbound shipping" name="shipping" inputMode="decimal" placeholder="0.00" hint="Supplier shipping. Part of cost, not overhead." />
        <Field label="Fees" name="fees" inputMode="decimal" placeholder="0.00" hint="Payment processing and marketplace commission." />
        <Field label="Refunds" name="refunds" inputMode="decimal" placeholder="0.00" hint="Recorded on the day issued, not the day sold." />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Refunded units" name="refundUnits" type="number" min={0} defaultValue={0} />
        <label className="block sm:col-span-2">
          <span className="block text-xs font-medium text-ink-700">Note</span>
          <input
            name="note"
            maxLength={500}
            placeholder="Anything worth remembering about this day"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-sm font-medium text-sand-100 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save the day'}
        </button>
        <p className="text-xs text-ink-500">
          Re-entering the same day, product and channel corrects it rather than adding to it.
        </p>
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
