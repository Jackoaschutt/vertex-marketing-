'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CartLine } from '@/lib/commerce/types'

const STORAGE_KEY = 'vesper.cart.v1'
const MAX_LINES = 20
const MAX_QTY = 20

interface CartContextValue {
  lines: CartLine[]
  count: number
  ready: boolean
  add: (variantId: string, qty?: number) => void
  setQty: (variantId: string, qty: number) => void
  remove: (variantId: string) => void
  clear: () => void
  justAdded: string | null
}

const CartContext = createContext<CartContextValue | null>(null)

function read(): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (l): l is CartLine =>
          typeof l === 'object' && l !== null && typeof l.variantId === 'string' && Number.isFinite(l.qty)
      )
      .slice(0, MAX_LINES)
      .map((l) => ({ variantId: l.variantId, qty: Math.max(1, Math.min(MAX_QTY, Math.round(l.qty))) }))
  } catch {
    return []
  }
}

/**
 * Client cart.
 *
 * Stores only {variantId, qty}. Prices are never held here — the server
 * re-prices on every cart view and at checkout, so a tampered localStorage
 * cannot change what anyone is charged.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)

  useEffect(() => {
    setLines(read())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // Storage can be unavailable (private mode, quota). The cart still works
      // for this page view; it just will not survive a reload.
    }
  }, [lines, ready])

  // Keep tabs in sync so a second tab does not silently overwrite the cart.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((variantId: string, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variantId)
      if (existing) {
        return prev.map((l) =>
          l.variantId === variantId ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l
        )
      }
      if (prev.length >= MAX_LINES) return prev
      return [...prev, { variantId, qty: Math.min(MAX_QTY, Math.max(1, qty)) }]
    })
    setJustAdded(variantId)
    window.setTimeout(() => setJustAdded(null), 2200)
  }, [])

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(MAX_QTY, qty) } : l))
    )
  }, [])

  const remove = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      ready,
      add,
      setQty,
      remove,
      clear,
      justAdded,
    }),
    [lines, ready, add, setQty, remove, clear, justAdded]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>.')
  return ctx
}
