// All money in this system is integer minor units (cents).
// Floating point never touches a monetary value.

export type Cents = number

export function toCents(input: string | number): Cents {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : 0
  }
  const cleaned = input.replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function formatMoney(cents: Cents, currency = 'USD', locale = 'en-US'): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(safe / 100)
}

/** Compact form for dashboards: $1.2k, $34.5k. */
export function formatMoneyCompact(cents: Cents, currency = 'USD'): string {
  const abs = Math.abs(cents)
  if (abs < 100_000) return formatMoney(cents, currency)
  const units = cents / 100
  const sign = units < 0 ? '-' : ''
  const a = Math.abs(units)
  const symbol = currency === 'USD' ? '$' : ''
  if (a >= 1_000_000) return `${sign}${symbol}${(a / 1_000_000).toFixed(1)}M`
  return `${sign}${symbol}${(a / 1000).toFixed(1)}k`
}

export function formatPercent(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(digits)}%`
}

export function formatRatio(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

/**
 * Division that returns null instead of Infinity/NaN.
 * Every rate in the analytics layer goes through this so the UI can render
 * "insufficient data" rather than a misleading 0% or NaN.
 */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator) || !Number.isFinite(numerator)) return null
  return numerator / denominator
}

/** Percentage-based fee in cents, rounded half-up. */
export function percentOf(cents: Cents, percent: number): Cents {
  return Math.round((cents * percent) / 100)
}

/**
 * Payment processor fee. Defaults match Stripe's standard US card rate;
 * both parts are configurable through ds_settings.
 */
export function paymentFee(totalCents: Cents, percent = 2.9, fixedCents = 30): Cents {
  if (totalCents <= 0) return 0
  return percentOf(totalCents, percent) + fixedCents
}

/** Gross margin as a ratio of price. Null when there is no price. */
export function grossMargin(priceCents: Cents, costCents: Cents, shipCents = 0): number | null {
  if (priceCents <= 0) return null
  return (priceCents - costCents - shipCents) / priceCents
}

export function profitPerUnit(priceCents: Cents, costCents: Cents, shipCents = 0): Cents {
  return priceCents - costCents - shipCents
}
