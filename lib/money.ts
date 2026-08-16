/**
 * Money, in whole pennies.
 *
 * Floats cannot represent 0.1, so 0.1 + 0.2 is 0.30000000000000004. Do that
 * across a few hundred rows and your totals are quietly wrong. Everything here
 * is an integer count of the smallest unit, converted only when displayed.
 */

import type { Entry } from './store'

export function toCents(input: string | number): number {
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function formatMoney(cents: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100)
}

/** Rates with no denominator return null, so the UI can show a dash rather than a misleading 0%. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null
  const result = numerator / denominator
  return Number.isFinite(result) ? result : null
}

export function formatPercent(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`
}

export interface Totals {
  incomeCents: number
  expenseCents: number
  profitCents: number
  margin: number | null
  byCategory: { category: string; cents: number }[]
}

export function totalsFor(entries: Entry[]): Totals {
  let income = 0
  let expense = 0
  const categories = new Map<string, number>()

  for (const e of entries) {
    if (e.kind === 'income') {
      income += e.amountCents
    } else {
      expense += e.amountCents
      categories.set(e.category, (categories.get(e.category) ?? 0) + e.amountCents)
    }
  }

  return {
    incomeCents: income,
    expenseCents: expense,
    // Income minus what it cost to earn it. Never call income "profit".
    profitCents: income - expense,
    margin: safeDivide(income - expense, income),
    byCategory: [...categories.entries()]
      .map(([category, cents]) => ({ category, cents }))
      .sort((a, b) => b.cents - a.cents),
  }
}

export function monthKey(day: string): string {
  return day.slice(0, 7)
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

export function inMonth(entries: Entry[], key: string): Entry[] {
  return entries.filter((e) => monthKey(e.day) === key)
}

/** Every month that has entries, newest first. */
export function monthsPresent(entries: Entry[]): string[] {
  return [...new Set(entries.map((e) => monthKey(e.day)))].sort().reverse()
}
