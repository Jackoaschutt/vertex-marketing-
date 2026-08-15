'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/commerce/money'
import type { ProductVariant } from '@/lib/commerce/types'
import { useCart } from './CartProvider'

interface Props {
  productName: string
  variants: ProductVariant[]
  currency: string
}

export function ProductActions({ productName, variants, currency }: Props) {
  const { add } = useCart()
  const router = useRouter()

  const orderedVariants = useMemo(
    () => [...variants].sort((a, b) => a.position - b.position),
    [variants]
  )
  const [variantId, setVariantId] = useState(
    () => (orderedVariants.find((v) => v.is_default) ?? orderedVariants[0])?.id ?? ''
  )
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  const selected = orderedVariants.find((v) => v.id === variantId) ?? orderedVariants[0]
  const soldOut = !!selected && selected.stock !== null && selected.stock <= 0
  const lowStock = !!selected && selected.stock !== null && selected.stock > 0 && selected.stock <= 10
  const hasChoices = orderedVariants.length > 1

  function handleAdd() {
    if (!selected || soldOut) return
    add(selected.id, qty)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2200)
  }

  async function handleBuyNow() {
    if (!selected || soldOut) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/commerce/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: [{ variantId: selected.id, qty }] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Checkout is unavailable right now.')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Could not reach the checkout. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!selected) {
    return (
      <p className="rounded-xl border border-ink-200 bg-sand-50 p-4 text-sm text-ink-600">
        This product has no purchasable options yet.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {hasChoices && (
        <fieldset>
          <legend className="commerce-eyebrow mb-2.5 text-ink-500">
            {Object.keys(selected.options)[0] ?? 'Option'}
          </legend>
          <div className="flex flex-wrap gap-2">
            {orderedVariants.map((v) => {
              const out = v.stock !== null && v.stock <= 0
              const active = v.id === variantId
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-full border px-4 text-sm transition ${
                    active
                      ? 'border-ink-900 bg-ink-900 text-sand-100'
                      : 'border-ink-300 text-ink-800 hover:border-ink-900'
                  } ${out ? 'line-through opacity-50' : ''}`}
                >
                  {v.title}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full border border-ink-300">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="flex h-11 w-11 items-center justify-center rounded-l-full text-lg text-ink-700 transition hover:bg-ink-100 disabled:opacity-40"
            disabled={qty <= 1}
          >
            −
          </button>
          <span aria-live="polite" className="w-9 text-center text-sm tabular-nums text-ink-900">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            aria-label="Increase quantity"
            className="flex h-11 w-11 items-center justify-center rounded-r-full text-lg text-ink-700 transition hover:bg-ink-100 disabled:opacity-40"
            disabled={qty >= 20}
          >
            +
          </button>
        </div>
        <span className="text-sm text-ink-600">
          {formatMoney(selected.price_cents * qty, currency)}
        </span>
      </div>

      {lowStock && (
        <p className="text-sm text-ink-600">
          {selected.stock} left with our supplier. We show real stock, not a countdown.
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleAdd}
          disabled={soldOut}
          className="flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-ink-900 px-6 text-[0.95rem] font-medium text-sand-100 transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          {soldOut ? 'Sold out' : added ? 'Added to cart ✓' : `Add to cart — ${formatMoney(selected.price_cents * qty, currency)}`}
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={soldOut || busy}
          className="flex min-h-[3.25rem] w-full items-center justify-center rounded-full border border-ink-900 px-6 text-[0.95rem] font-medium text-ink-900 transition hover:bg-ink-900 hover:text-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Opening checkout…' : 'Buy now'}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-clay-500/40 bg-clay-400/10 p-3 text-sm text-clay-600">
          {error}
        </p>
      )}

      {/* Sticky purchase control for mobile, where the buttons scroll away. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-sand-100/95 p-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{productName}</p>
            <p className="text-xs text-ink-600">{formatMoney(selected.price_cents * qty, currency)}</p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            className="min-h-11 shrink-0 rounded-full bg-ink-900 px-5 text-sm font-medium text-sand-100 disabled:bg-ink-300"
          >
            {soldOut ? 'Sold out' : added ? 'Added ✓' : 'Add to cart'}
          </button>
        </div>
      </div>
      {/* Spacer so the sticky bar never covers page content on mobile. */}
      <div aria-hidden className="h-16 md:hidden" />
      <button type="button" onClick={() => router.refresh()} className="sr-only">
        Refresh availability
      </button>
    </div>
  )
}
