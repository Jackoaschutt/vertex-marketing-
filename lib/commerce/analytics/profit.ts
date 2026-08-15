/**
 * The books.
 *
 * Every figure here is computed from three hand-entered sources and nothing
 * else: the sales ledger (ds_sales), ad spend (ds_ad_metrics) and other costs
 * (ds_expenses). No total is cached back onto a product, because a bookkeeping
 * tool with two answers to "what did this earn" is worse than useless.
 *
 * Three rules this file exists to enforce:
 *
 *   1. Revenue is not profit. They are separate fields all the way through and
 *      are never conflated in a return value or a label.
 *   2. Refunds reduce revenue. A refunded sale is not income.
 *   3. A rate with no denominator is null, not zero. Zero ad spend does not
 *      mean infinite ROAS, and no sales does not mean a 0% margin.
 */

import { safeDivide } from '../money'
import { listAdMetrics, listExpenses, listProducts, listSales } from '../db/repo'
import type { AdMetric, Expense, Product, SaleEntry } from '../types'

export interface ProfitSummary {
  /** Money taken, after refunds. */
  revenueCents: number
  refundsCents: number
  /** What the goods and their inbound shipping cost. */
  cogsCents: number
  /** Payment processing and marketplace fees. */
  feesCents: number
  adSpendCents: number
  /** Everything that is neither COGS nor advertising. */
  expensesCents: number

  /** revenue − COGS. Says nothing about whether the business made money. */
  grossProfitCents: number
  /** gross − fees − ad spend − expenses. This is the number that matters. */
  netProfitCents: number

  units: number
  refundUnits: number

  /** null when there is no denominator — never a misleading zero. */
  grossMargin: number | null
  netMargin: number | null
  roas: number | null
  /** Ad cost per unit sold. */
  cpaCents: number | null
  revenuePerUnitCents: number | null
  refundRate: number | null
}

export const EMPTY_SUMMARY: ProfitSummary = {
  revenueCents: 0,
  refundsCents: 0,
  cogsCents: 0,
  feesCents: 0,
  adSpendCents: 0,
  expensesCents: 0,
  grossProfitCents: 0,
  netProfitCents: 0,
  units: 0,
  refundUnits: 0,
  grossMargin: null,
  netMargin: null,
  roas: null,
  cpaCents: null,
  revenuePerUnitCents: null,
  refundRate: null,
}

export interface ProfitInputs {
  sales: SaleEntry[]
  adMetrics: AdMetric[]
  expenses: Expense[]
}

export function computeProfit({ sales, adMetrics, expenses }: ProfitInputs): ProfitSummary {
  let gross = 0
  let refunds = 0
  let cogs = 0
  let fees = 0
  let units = 0
  let refundUnits = 0

  for (const s of sales) {
    gross += s.revenue_cents
    refunds += s.refunds_cents
    // Inbound shipping is part of what the goods cost us, not an overhead.
    cogs += s.cogs_cents + s.shipping_cost_cents
    fees += s.fees_cents
    units += s.units
    refundUnits += s.refund_units
  }

  const adSpend = adMetrics.reduce((sum, m) => sum + m.spend_cents, 0)
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount_cents, 0)

  const revenue = gross - refunds
  const grossProfit = revenue - cogs
  const netProfit = grossProfit - fees - adSpend - expenseTotal
  const netUnits = units - refundUnits

  return {
    revenueCents: revenue,
    refundsCents: refunds,
    cogsCents: cogs,
    feesCents: fees,
    adSpendCents: adSpend,
    expensesCents: expenseTotal,
    grossProfitCents: grossProfit,
    netProfitCents: netProfit,
    units,
    refundUnits,
    grossMargin: safeDivide(grossProfit, revenue),
    netMargin: safeDivide(netProfit, revenue),
    roas: safeDivide(revenue, adSpend),
    cpaCents: netUnits > 0 ? Math.round(adSpend / netUnits) : null,
    revenuePerUnitCents: netUnits > 0 ? Math.round(revenue / netUnits) : null,
    refundRate: safeDivide(refundUnits, units),
  }
}

export interface ProductPnl {
  product: Product
  summary: ProfitSummary
}

/**
 * Per-product P&L.
 *
 * Ad spend that could not be attributed to a product (`product_id` null) is
 * deliberately excluded here and reported separately by the caller. Spreading
 * it evenly would invent a number; dropping it silently would make the parts
 * disagree with the whole.
 */
export function computeProductPnl(
  products: Product[],
  sales: SaleEntry[],
  adMetrics: AdMetric[]
): ProductPnl[] {
  const byProduct = new Map<string, { sales: SaleEntry[]; ads: AdMetric[] }>()
  const bucket = (id: string) => {
    let b = byProduct.get(id)
    if (!b) {
      b = { sales: [], ads: [] }
      byProduct.set(id, b)
    }
    return b
  }

  for (const s of sales) if (s.product_id) bucket(s.product_id).sales.push(s)
  for (const m of adMetrics) if (m.product_id) bucket(m.product_id).ads.push(m)

  return products
    .map((product) => {
      const b = byProduct.get(product.id)
      return {
        product,
        summary: b
          ? computeProfit({ sales: b.sales, adMetrics: b.ads, expenses: [] })
          : EMPTY_SUMMARY,
      }
    })
    .sort((a, b) => b.summary.netProfitCents - a.summary.netProfitCents)
}

/** Ad spend with no product attached. Reported, never spread or dropped. */
export function unattributedAdSpend(adMetrics: AdMetric[]): number {
  return adMetrics.filter((m) => !m.product_id).reduce((sum, m) => sum + m.spend_cents, 0)
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface DailyPoint {
  day: string
  revenueCents: number
  adSpendCents: number
  netProfitCents: number
}

/** One point per day across the window, including days with no activity. */
export function buildDailySeries(
  sales: SaleEntry[],
  adMetrics: AdMetric[],
  days: number
): DailyPoint[] {
  const out: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = daysAgoIso(i)
    const daySales = sales.filter((s) => s.day === day)
    const dayAds = adMetrics.filter((m) => m.day === day)
    const summary = computeProfit({ sales: daySales, adMetrics: dayAds, expenses: [] })
    out.push({
      day,
      revenueCents: summary.revenueCents,
      adSpendCents: summary.adSpendCents,
      netProfitCents: summary.netProfitCents,
    })
  }
  return out
}

export interface DashboardData {
  today: ProfitSummary
  week: ProfitSummary
  month: ProfitSummary
  allTime: ProfitSummary
  series: DailyPoint[]
  productPnl: ProductPnl[]
  unattributedAdSpendCents: number
  hasAnyData: boolean
}

export async function loadDashboard(): Promise<DashboardData> {
  const monthStart = daysAgoIso(29)
  const [products, sales, adMetrics, expenses] = await Promise.all([
    listProducts({}),
    listSales(),
    listAdMetrics(),
    listExpenses(),
  ])

  const within = (since: string) => ({
    sales: sales.filter((s) => s.day >= since),
    adMetrics: adMetrics.filter((m) => m.day >= since),
    expenses: expenses.filter((e) => e.day >= since),
  })

  const monthWindow = within(monthStart)

  return {
    today: computeProfit(within(todayIso())),
    week: computeProfit(within(daysAgoIso(6))),
    month: computeProfit(monthWindow),
    allTime: computeProfit({ sales, adMetrics, expenses }),
    series: buildDailySeries(monthWindow.sales, monthWindow.adMetrics, 30),
    productPnl: computeProductPnl(products, sales, adMetrics),
    unattributedAdSpendCents: unattributedAdSpend(adMetrics),
    hasAnyData: sales.length > 0 || adMetrics.length > 0 || expenses.length > 0,
  }
}
