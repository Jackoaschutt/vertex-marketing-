'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SpendForm({ products }: { products: { id: string; name: string }[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const form = new FormData(e.currentTarget)
    const money = (v: FormDataEntryValue | null) =>
      Math.round((Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0) * 100)

    try {
      const res = await fetch('/api/commerce/marketing/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.get('productId') || '',
          channel: form.get('channel'),
          campaignRef: form.get('campaignRef') || '',
          day: form.get('day'),
          impressions: Number(form.get('impressions') || 0),
          clicks: Number(form.get('clicks') || 0),
          spendCents: money(form.get('spend')),
          purchases: Number(form.get('purchases') || 0),
          revenueCents: money(form.get('revenue')),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({
          tone: 'err',
          text: Array.isArray(data.issues) && data.issues.length ? data.issues.join(' ') : data.error,
        })
        return
      }
      setMessage({ tone: 'ok', text: 'Recorded. ROAS, CPA and profit now include this.' })
      router.refresh()
    } catch {
      setMessage({ tone: 'err', text: 'Request failed.' })
    } finally {
      setBusy(false)
    }
  }

  const field =
    'mt-1 w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-ink-900'
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm text-ink-600">
        Product
        <select name="productId" className={field} defaultValue="">
          <option value="">(unattributed)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Channel
        <select name="channel" className={field} defaultValue="meta">
          <option value="meta">Meta</option>
          <option value="tiktok">TikTok</option>
          <option value="google">Google</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Day
        <input type="date" name="day" defaultValue={today} className={field} required />
      </label>
      <label className="text-sm text-ink-600">
        Campaign reference
        <input name="campaignRef" className={field} placeholder="q3-evergreen" />
      </label>
      <label className="text-sm text-ink-600">
        Spend
        <input name="spend" inputMode="decimal" defaultValue="0.00" className={field} required />
      </label>
      <label className="text-sm text-ink-600">
        Attributed revenue
        <input name="revenue" inputMode="decimal" defaultValue="0.00" className={field} />
      </label>
      <label className="text-sm text-ink-600">
        Impressions
        <input type="number" name="impressions" min={0} defaultValue={0} className={field} />
      </label>
      <label className="text-sm text-ink-600">
        Clicks
        <input type="number" name="clicks" min={0} defaultValue={0} className={field} />
      </label>
      <label className="text-sm text-ink-600">
        Purchases
        <input type="number" name="purchases" min={0} defaultValue={0} className={field} />
      </label>

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-full bg-ink-900 px-5 text-sm font-medium text-sand-100 transition hover:bg-ink-800 disabled:bg-ink-300"
        >
          {busy ? 'Saving…' : 'Record spend'}
        </button>
        {message && (
          <p className={`mt-2 text-sm ${message.tone === 'ok' ? 'text-moss-500' : 'text-clay-600'}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}
