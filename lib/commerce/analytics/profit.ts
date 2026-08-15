/**
 * Profit engine.
 *
 * Revenue is never reported as profit. Every figure below is derived from
 * stored integer cents; nothing is estimated or interpolated. Rates return null
 * when the denominator is zero so the UI can render "—" instead of a
 * misleading 0% or NaN.
 */

import { paymentFee, safeDivide } from '../money'
import {
  listAdMetrics,
  listExpenses,
  listOrderItemsForOrders,
  listOrders,
  listProducts,
} from '../db/repo'
import type { AdMetric, Expense, Order, OrderItem, Product } from '../types'

/** Orders that represent money actually taken. */
const REVENUE_STATUSES: Order['status'][] = [
  'received',
  'validated',
  'routed',
  'submitted',
  'fulfilled',
  'delivered',
  'needs_attention',
  'refunded',
]

export interface ProfitSummary {
  orders: number
  units: number
  grossRevenueCents: number
  discountsCents: number
  refundsCents: number
  netRevenueCents: number
  cogsCents: number
  shippingCostCents: number
  grossProfitCents: number
  paymentFeesCents: number
  adSpendCents: number
  otherExpensesCents: number
  netProfitCents: number
  /** netProfit / netRevenue */
  netMargin: number | null
  /** grossProfit / netRevenue */
  grossMargin: number | null
  aovCents: number | null
  roas: number | null
  cpaCents: number | null
  refundRate: number | null
  sessions: number
  conversionRate: number | null
}

export const EMPTY_SUMMARY: ProfitSummary = {
  orders: 0,
  units: 0,
  grossRevenueCents: 0,
  discountsCents: 0,
  refundsCents: 0,
  netRevenueCents: 0,
  cogsCents: 0,
  shippingCostCents: 0,
  grossProfitCents: 0,
  paymentFeesCents: 0,
  adSpendCents: 0,
  otherExpensesCents: 0,
  netProfitCents: 0,
  netMargin: null,
  grossMargin: null,
  aovCents: null,
  roas: null,
  cpaCents: null,
  refundRate: null,
  sessions: 0,
  conversionRate: null,
}

export interface ProfitInputs {
  orders: Order[]
  items: OrderItem[]
  adMetrics: AdMetric[]
  expenses: Expense[]
  sessions?: number
  feePercent?: number
  feeFixedCents?: number
}

export function computeProfit(input: ProfitInputs): ProfitSummary {
  const feePercent = input.feePercent ?? 2.9
  const feeFixed = input.feeFixedCents ?? 30

  const counted = input.orders.filter((o) => REVENUE_STATUSES.includes(o.status))
  const countedIds = new Set(counted.map((o) => o.id))
  const items = input.items.filter((i) => countedIds.has(i.order_id))

  const grossRevenueCents = counted.reduce((s, o) => s + o.subtotal_cents, 0)
  const discountsCents = counted.reduce((s, o) => s + o.discount_cents, 0)
  const refundsCents = counted.reduce((s, o) => s + o.refund_cents, 0)
  const netRevenueCents = grossRevenueCents - discountsCents - refundsCents

  const cogsCents = items.reduce((s, i) => s + i.unit_cost_cents * i.quantity, 0)
  const shippingCostCents = counted.reduce((s, o) => s + o.shipping_cents, 0)
  const units = items.reduce((s, i) => s + i.quantity, 0)

  // Gross profit keeps the shipping the customer paid on the revenue side and
  // the supplier's landed cost on the cost side; net of the two is what the
  // COGS line already carries, so shipping revenue is not double-counted here.
  const grossProfitCents = netRevenueCents - cogsCents

  const paymentFeesCents = counted.reduce(
    (s, o) => s + (o.payment_fee_cents || paymentFee(o.total_cents, feePercent, feeFixed)),
    0
  )
  const adSpendCents = input.adMetrics.reduce((s, m) => s + m.spend_cents, 0)
  const otherExpensesCents = input.expenses.reduce((s, e) => s + e.amount_cents, 0)

  const netProfitCents =
    grossProfitCents - paymentFeesCents - adSpendCents - otherExpensesCents

  const refundedOrders = counted.filter((o) => o.refund_cents > 0).length
  const purchases = counted.length

  return {
    orders: purchases,
    units,
    grossRevenueCents,
    discountsCents,
    refundsCents,
    netRevenueCents,
    cogsCents,
    shippingCostCents,
    grossProfitCents,
    paymentFeesCents,
    adSpendCents,
    otherExpensesCents,
    netProfitCents,
    netMargin: safeDivide(netProfitCents, netRevenueCents),
    grossMargin: safeDivide(grossProfitCents, netRevenueCents),
    aovCents: purchases > 0 ? Math.round(grossRevenueCents / purchases) : null,
    roas: safeDivide(netRevenueCents, adSpendCents),
    cpaCents: purchases > 0 && adSpendCents > 0 ? Math.round(adSpendCents / purchases) : null,
    refundRate: safeDivide(refundedOrders, purchases),
    sessions: input.sessions ?? 0,
    conversionRate: input.sessions ? safeDivide(purchases, input.sessions) : null,
  }
}

export interface ProductPnl {
  product: Product
  orders: number
  units: number
  revenueCents: number
  cogsCents: number
  grossProfitCents: number
  adSpendCents: number
  netProfitCents: number
  roas: number | null
  cpaCents: number | null
  conversionRate: number | null
  refundRate: number | null
}

export function computeProductPnl(
  products: Product[],
  orders: Order[],
  items: OrderItem[],
  adMetrics: AdMetric[]
): ProductPnl[] {
  const counted = orders.filter((o) => REVENUE_STATUSES.includes(o.status))
  const orderById = new Map(counted.map((o) => [o.id, o]))

  return products
    .map((product) => {
      const productItems = items.filter(
        (i) => i.product_id === product.id && orderById.has(i.order_id)
      )
      const orderIds = new Set(productItems.map((i) => i.order_id))
      const revenueCents = productItems.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0)
      const cogsCents = productItems.reduce((s, i) => s + i.unit_cost_cents * i.quantity, 0)
      const units = productItems.reduce((s, i) => s + i.quantity, 0)
      const adSpendCents = adMetrics
        .filter((m) => m.product_id === product.id)
        .reduce((s, m) => s + m.spend_cents, 0)
      const grossProfitCents = revenueCents - cogsCents
      const refunded = [...orderIds].filter((id) => (orderById.get(id)?.refund_cents ?? 0) > 0).length

      return {
        product,
        orders: orderIds.size,
        units,
        revenueCents,
        cogsCents,
        grossProfitCents,
        adSpendCents,
        netProfitCents: grossProfitCents - adSpendCents,
        roas: safeDivide(revenueCents, adSpendCents),
        cpaCents: orderIds.size > 0 && adSpendCents > 0 ? Math.round(adSpendCents / orderIds.size) : null,
        conversionRate: product.sessions_count
          ? safeDivide(orderIds.size, product.sessions_count)
          : null,
        refundRate: safeDivide(refunded, orderIds.size),
      }
    })
    .sort((a, b) => b.netProfitCents - a.netProfitCents)
}

// --- Convenience loaders ---------------------------------------------------

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export interface DashboardData {
  today: ProfitSummary
  week: ProfitSummary
  month: ProfitSummary
  allTime: ProfitSummary
  productPnl: ProductPnl[]
  dailySeries: { day: string; revenueCents: number; profitCents: number; adSpendCents: number }[]
}

export async function loadDashboard(): Promise<DashboardData> {
  const since = daysAgoIso(90)
  const [orders, products, adMetrics, expenses] = await Promise.all([
    listOrders({ since, limit: 2000 }),
    listProducts({}),
    listAdMetrics(since.slice(0, 10)),
    listExpenses(since.slice(0, 10)),
  ])
  const items = await listOrderItemsForOrders(orders.map((o) => o.id))

  const sessionsTotal = products.reduce((s, p) => s + p.sessions_count, 0)

  const window = (fromIso: string): ProfitSummary => {
    const o = orders.filter((x) => x.placed_at >= fromIso)
    const ids = new Set(o.map((x) => x.id))
    const fromDay = fromIso.slice(0, 10)
    return computeProfit({
      orders: o,
      items: items.filter((i) => ids.has(i.order_id)),
      adMetrics: adMetrics.filter((m) => m.day >= fromDay),
      expenses: expenses.filter((e) => e.day >= fromDay),
    })
  }

  // Daily series for charts — 30 days, always dense so the chart has no gaps.
  const dailySeries: DashboardData['dailySeries'] = []
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const key = dayStart.toISOString().slice(0, 10)
    const dayOrders = orders.filter(
      (o) => o.placed_at >= dayStart.toISOString() && o.placed_at < dayEnd.toISOString()
    )
    const ids = new Set(dayOrders.map((o) => o.id))
    const summary = computeProfit({
      orders: dayOrders,
      items: items.filter((it) => ids.has(it.order_id)),
      adMetrics: adMetrics.filter((m) => m.day === key),
      expenses: expenses.filter((e) => e.day === key),
    })
    dailySeries.push({
      day: key,
      revenueCents: summary.netRevenueCents,
      profitCents: summary.netProfitCents,
      adSpendCents: summary.adSpendCents,
    })
  }

  const allTime = computeProfit({ orders, items, adMetrics, expenses, sessions: sessionsTotal })

  return {
    today: window(startOfTodayIso()),
    week: window(daysAgoIso(7)),
    month: window(daysAgoIso(30)),
    allTime,
    productPnl: computeProductPnl(products, orders, items, adMetrics),
    dailySeries,
  }
}
