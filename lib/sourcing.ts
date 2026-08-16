/**
 * Comparing suppliers on what they actually cost you.
 *
 * The sticker price is the least useful number a supplier shows you. Landed
 * cost — unit plus the shipping you pay — is what decides whether a product can
 * carry its own advertising.
 */

import type { Supplier } from './store'
import { safeDivide } from './money'

export interface Vetting {
  key: string
  label: string
  why: string
}

/**
 * The questions worth answering before committing.
 *
 * Each one is a real failure people hit, in rough order of how expensive it is
 * to discover late.
 */
export const VETTING: Vetting[] = [
  {
    key: 'sample',
    label: 'Ordered a sample yourself',
    why: 'You cannot sell what you have not held. Photos hide weight, finish, smell and packaging — and those are what drive returns.',
  },
  {
    key: 'delivery-time',
    label: 'Timed how long delivery actually took',
    why: 'The advertised time is a best case. The real one is what your customers will experience, and slow delivery is the most common cause of refunds.',
  },
  {
    key: 'total-cost',
    label: 'Confirmed the full landed cost, including shipping',
    why: 'Unit cost without shipping has killed more first stores than bad advertising.',
  },
  {
    key: 'stock',
    label: 'Asked what happens if you order 10× more',
    why: 'Running out mid-campaign turns your best week into refunds and a damaged ad account.',
  },
  {
    key: 'returns',
    label: 'Agreed what happens with faulty items',
    why: 'Some percentage will arrive broken. Knowing in advance who pays is the difference between an annoyance and a loss.',
  },
  {
    key: 'responsive',
    label: 'Messaged them and got a useful reply within a day',
    why: 'How they answer before you are a customer is the best case. It gets worse, not better, once there is a problem.',
  },
]

export interface SupplierMetrics {
  landedCents: number
  /** Profit per unit at a given sell price. */
  marginCents: (sellCents: number) => number
  marginPercent: (sellCents: number) => number | null
  /** How many vetting questions have been answered. */
  vetted: number
  /** Slowest realistic delivery, which is the one customers judge you on. */
  worstCaseDays: number
}

export function metricsFor(s: Supplier): SupplierMetrics {
  const landedCents = s.unitCostCents + s.shippingCostCents
  return {
    landedCents,
    marginCents: (sellCents) => sellCents - landedCents,
    marginPercent: (sellCents) => safeDivide(sellCents - landedCents, sellCents),
    vetted: VETTING.filter((v) => s.checks[v.key]).length,
    worstCaseDays: s.leadDaysMax,
  }
}

/**
 * The price you would need to charge to hit a target margin.
 * Working backwards from margin is more useful than guessing a price and
 * checking it afterwards.
 */
export function priceForMargin(landedCents: number, targetMargin: number): number {
  if (targetMargin >= 1 || targetMargin <= 0) return 0
  return Math.round(landedCents / (1 - targetMargin))
}

export interface Comparison {
  supplier: Supplier
  landedCents: number
  cheapest: boolean
  fastest: boolean
  bestVetted: boolean
  vetted: number
}

/** Side by side, flagging which wins on each axis rather than picking one. */
export function compare(suppliers: Supplier[]): Comparison[] {
  if (suppliers.length === 0) return []
  const withMetrics = suppliers.map((s) => ({ supplier: s, ...metricsFor(s) }))

  const minLanded = Math.min(...withMetrics.map((s) => s.landedCents))
  const minDays = Math.min(...withMetrics.map((s) => s.worstCaseDays))
  const maxVetted = Math.max(...withMetrics.map((s) => s.vetted))

  return withMetrics
    .map((s) => ({
      supplier: s.supplier,
      landedCents: s.landedCents,
      cheapest: s.landedCents === minLanded,
      fastest: s.worstCaseDays === minDays,
      bestVetted: s.vetted === maxVetted && s.vetted > 0,
      vetted: s.vetted,
    }))
    .sort((a, b) => a.landedCents - b.landedCents)
}
