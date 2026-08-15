'use client'

import { useEffect } from 'react'
import { useCart } from './CartProvider'

/**
 * Empties the local cart once the order has been confirmed server-side.
 * Rendered only on the confirmation page, so an abandoned checkout keeps its
 * cart intact.
 */
export function ClearCartOnMount({ active }: { active: boolean }) {
  const { clear, ready } = useCart()
  useEffect(() => {
    if (active && ready) clear()
  }, [active, ready, clear])
  return null
}
