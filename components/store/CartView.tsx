'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { formatMoney } from '@/lib/commerce/money'
import type { PricedCart } from '@/lib/commerce/types'
import { useCart } from './CartProvider'

/**
 * Cart page.
 *
 * Every price shown here comes back from the server, not from localStorage, so
 * what the customer sees is what checkout will charge.
 */
export function CartView({ freeShippingThresholdCents }: { freeShippingThresholdCents: number }) {
  const { lines, ready, setQty, remove } = useCart()
  const [cart, setCart] = useState<PricedCart | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const revalidate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/commerce/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not price your cart.')
        return
      }
      setCart(data)
    } catch {
      setError('Could not reach the server to price your cart.')
    } finally {
      setLoading(false)
    }
  }, [lines])

  useEffect(() => {
    if (!ready) return
    if (lines.length === 0) {
      setCart(null)
      setLoading(false)
      return
    }
    void revalidate()
  }, [ready, lines, revalidate])

  async function checkout() {
    setCheckingOut(true)
    setError(null)
    try {
      const res = await fetch('/api/commerce/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.requires
            ? `${data.error} Missing configuration: ${(data.requires as string[]).join(', ')}.`
            : (data.error ?? 'Checkout is unavailable right now.')
        )
        return
      }
      window.location.href = data.url
    } catch {
      setError('Could not reach the checkout. Check your connection and try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  if (!ready || loading) {
    return <p className="py-16 text-center text-sm text-ink-500">Pricing your cart…</p>
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="commerce-display text-3xl text-ink-900">Your cart is empty</p>
        <p className="mx-auto mt-3 max-w-sm text-[0.95rem] text-ink-600">
          Nothing here yet. We keep a short list, so it will not take long to look through.
        </p>
        <Link
          href="/store/shop"
          className="mt-7 inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-sm font-medium text-sand-100 transition hover:bg-ink-800"
        >
          Browse the shop
        </Link>
      </div>
    )
  }

  const remaining = freeShippingThresholdCents - cart.subtotalCents

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y divide-ink-200 border-y border-ink-200">
        {cart.lines.map((line) => (
          <li key={line.variantId} className="flex gap-4 py-5">
            <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-sand-200">
              {line.image && (
                <Image src={line.image} alt="" fill sizes="80px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {line.slug ? (
                    <Link href={`/store/product/${line.slug}`} className="text-[0.95rem] font-medium text-ink-900 hover:underline">
                      {line.title}
                    </Link>
                  ) : (
                    <span className="text-[0.95rem] font-medium text-ink-900">{line.title}</span>
                  )}
                  {line.variantTitle && line.variantTitle !== 'Default' && (
                    <p className="text-sm text-ink-600">{line.variantTitle}</p>
                  )}
                </div>
                <span className="shrink-0 text-[0.95rem] tabular-nums text-ink-900">
                  {formatMoney(line.lineTotalCents, cart.currency)}
                </span>
              </div>

              {!line.available && (
                <p className="mt-1.5 text-sm text-clay-600">{line.reason ?? 'Unavailable.'}</p>
              )}

              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center rounded-full border border-ink-300">
                  <button
                    type="button"
                    aria-label={`Decrease quantity of ${line.title}`}
                    onClick={() => setQty(line.variantId, line.qty - 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-l-full text-ink-700 transition hover:bg-ink-100"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">{line.qty}</span>
                  <button
                    type="button"
                    aria-label={`Increase quantity of ${line.title}`}
                    onClick={() => setQty(line.variantId, line.qty + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-r-full text-ink-700 transition hover:bg-ink-100"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(line.variantId)}
                  className="text-sm text-ink-500 underline underline-offset-4 transition hover:text-ink-900"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-2xl border border-ink-200 bg-sand-50 p-6 lg:sticky lg:top-24">
        <h2 className="commerce-eyebrow text-ink-500">Summary</h2>
        <dl className="mt-4 space-y-2.5 text-[0.95rem]">
          <div className="flex justify-between">
            <dt className="text-ink-600">Subtotal</dt>
            <dd className="tabular-nums text-ink-900">{formatMoney(cart.subtotalCents, cart.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-600">Delivery</dt>
            <dd className="tabular-nums text-ink-900">
              {cart.shippingCents === 0 ? 'Free' : formatMoney(cart.shippingCents, cart.currency)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-ink-200 pt-3 text-base">
            <dt className="font-medium text-ink-900">Total</dt>
            <dd className="font-medium tabular-nums text-ink-900">
              {formatMoney(cart.totalCents, cart.currency)}
            </dd>
          </div>
        </dl>

        {remaining > 0 && (
          <p className="mt-4 text-sm text-ink-600">
            {formatMoney(remaining, cart.currency)} more for free delivery.
          </p>
        )}

        {cart.hasUnavailable && (
          <p className="mt-4 rounded-lg border border-clay-500/40 bg-clay-400/10 p-3 text-sm text-clay-600">
            Some items are unavailable. They will not be charged — remove them or continue with the rest.
          </p>
        )}

        <button
          type="button"
          onClick={checkout}
          disabled={checkingOut || cart.subtotalCents === 0}
          className="mt-5 flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-ink-900 px-6 text-[0.95rem] font-medium text-sand-100 transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          {checkingOut ? 'Opening checkout…' : 'Checkout'}
        </button>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-clay-500/40 bg-clay-400/10 p-3 text-sm text-clay-600">
            {error}
          </p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Taxes and any duties are calculated at checkout. Payment is handled by Stripe — we never see
          your card details.
        </p>
      </aside>
    </div>
  )
}
