import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeProfit,
  computeProductPnl,
  unattributedAdSpend,
  buildDailySeries,
  daysAgoIso,
  EMPTY_SUMMARY,
} from '../lib/commerce/analytics/profit'
import type { AdMetric, Expense, Product, SaleEntry } from '../lib/commerce/types'

// The profit engine is the part of this tool that can be wrong without looking
// wrong. These tests exist to make the three ways it could lie impossible:
// calling revenue profit, ignoring refunds, and inventing a rate from nothing.

function sale(p: Partial<SaleEntry> = {}): SaleEntry {
  return {
    id: Math.random().toString(36).slice(2),
    day: '2026-08-01',
    product_id: null,
    channel: 'shopify',
    units: 0,
    revenue_cents: 0,
    cogs_cents: 0,
    shipping_cost_cents: 0,
    fees_cents: 0,
    refunds_cents: 0,
    refund_units: 0,
    note: null,
    created_at: '',
    updated_at: '',
    ...p,
  }
}

function ad(p: Partial<AdMetric> = {}): AdMetric {
  return {
    id: Math.random().toString(36).slice(2),
    product_id: null,
    channel: 'meta',
    campaign_ref: null,
    day: '2026-08-01',
    impressions: 0,
    clicks: 0,
    spend_cents: 0,
    purchases: 0,
    revenue_cents: 0,
    source: 'manual',
    created_at: '',
    ...p,
  }
}

function expense(amount: number): Expense {
  return {
    id: Math.random().toString(36).slice(2),
    label: 'Tool',
    category: 'software',
    amount_cents: amount,
    day: '2026-08-01',
    recurring: false,
    created_at: '',
  }
}

function product(id: string, name = id): Product {
  return {
    id,
    slug: id,
    name,
    tagline: null,
    category: null,
    target_audience: null,
    problem_solved: null,
    supplier_id: null,
    supplier_url: null,
    product_url: null,
    cost_cents: 0,
    shipping_cost_cents: 0,
    price_cents: 0,
    ship_days_min: 7,
    ship_days_max: 14,
    demand_score: 0,
    margin_score: 0,
    competition_score: 0,
    problem_score: 0,
    creative_score: 0,
    brandability_score: 0,
    shipping_score: 0,
    repeat_score: 0,
    risk_score: 0,
    product_score: 0,
    research_inputs: {},
    status: 'testing',
    sell_channel: null,
    date_discovered: '',
    date_tested: null,
    created_at: '',
    updated_at: '',
  }
}

test('revenue is never reported as profit', () => {
  const s = computeProfit({
    sales: [sale({ units: 10, revenue_cents: 10_000, cogs_cents: 4_000 })],
    adMetrics: [ad({ spend_cents: 3_000 })],
    expenses: [expense(1_000)],
  })

  assert.equal(s.revenueCents, 10_000)
  assert.equal(s.grossProfitCents, 6_000, 'gross is revenue minus cost of goods')
  assert.equal(s.netProfitCents, 2_000, 'net is gross minus fees, ads and expenses')
  assert.notEqual(s.revenueCents, s.netProfitCents)
})

test('inbound shipping is counted as cost of goods, not overhead', () => {
  const s = computeProfit({
    sales: [sale({ revenue_cents: 5_000, cogs_cents: 1_000, shipping_cost_cents: 500 })],
    adMetrics: [],
    expenses: [],
  })
  assert.equal(s.cogsCents, 1_500)
  assert.equal(s.grossProfitCents, 3_500)
})

test('refunds reduce revenue rather than being ignored', () => {
  const s = computeProfit({
    sales: [sale({ units: 10, revenue_cents: 10_000, refunds_cents: 2_500, refund_units: 2 })],
    adMetrics: [],
    expenses: [],
  })
  assert.equal(s.revenueCents, 7_500)
  assert.equal(s.refundsCents, 2_500)
  assert.equal(s.refundRate, 0.2)
})

test('fees are subtracted from net but not from gross', () => {
  const s = computeProfit({
    sales: [sale({ revenue_cents: 10_000, cogs_cents: 3_000, fees_cents: 500 })],
    adMetrics: [],
    expenses: [],
  })
  assert.equal(s.grossProfitCents, 7_000)
  assert.equal(s.netProfitCents, 6_500)
})

test('rates return null rather than a misleading zero when there is no denominator', () => {
  const s = computeProfit({ sales: [], adMetrics: [], expenses: [] })
  assert.equal(s.roas, null, 'no ad spend must not read as infinite or zero ROAS')
  assert.equal(s.grossMargin, null)
  assert.equal(s.netMargin, null)
  assert.equal(s.cpaCents, null)
  assert.equal(s.revenuePerUnitCents, null)
  assert.equal(s.refundRate, null)
})

test('ROAS and CPA are computed against net units, not gross', () => {
  const s = computeProfit({
    sales: [sale({ units: 10, refund_units: 5, revenue_cents: 10_000, refunds_cents: 5_000 })],
    adMetrics: [ad({ spend_cents: 5_000 })],
    expenses: [],
  })
  assert.equal(s.roas, 1, '5,000 revenue after refunds against 5,000 spend')
  assert.equal(s.cpaCents, 1_000, 'spend divided by the 5 units that were kept')
})

test('an empty summary is genuinely empty', () => {
  assert.equal(EMPTY_SUMMARY.netProfitCents, 0)
  assert.equal(EMPTY_SUMMARY.roas, null)
})

test('per-product P&L attributes only that product’s rows', () => {
  const a = product('a', 'Alpha')
  const b = product('b', 'Beta')
  const rows = computeProductPnl(
    [a, b],
    [
      sale({ product_id: 'a', units: 5, revenue_cents: 5_000, cogs_cents: 1_000 }),
      sale({ product_id: 'b', units: 1, revenue_cents: 1_000, cogs_cents: 900 }),
    ],
    [ad({ product_id: 'a', spend_cents: 1_000 })]
  )

  const alpha = rows.find((r) => r.product.id === 'a')!
  const beta = rows.find((r) => r.product.id === 'b')!
  assert.equal(alpha.summary.revenueCents, 5_000)
  assert.equal(alpha.summary.adSpendCents, 1_000)
  assert.equal(beta.summary.adSpendCents, 0, 'Beta must not absorb Alpha’s spend')
  assert.equal(rows[0].product.id, 'a', 'sorted by net profit, best first')
})

test('unattributed ad spend is excluded from products but reported separately', () => {
  const metrics = [ad({ product_id: 'a', spend_cents: 1_000 }), ad({ spend_cents: 2_500 })]
  const rows = computeProductPnl([product('a')], [], metrics)
  assert.equal(rows[0].summary.adSpendCents, 1_000)
  assert.equal(
    unattributedAdSpend(metrics),
    2_500,
    'orphan spend must be visible, never silently dropped or spread'
  )
})

test('a product with no ledger rows reports empty, not fabricated', () => {
  const rows = computeProductPnl([product('a')], [], [])
  assert.equal(rows[0].summary.revenueCents, 0)
  assert.equal(rows[0].summary.roas, null)
})

test('the daily series covers every day in the window, including empty ones', () => {
  const today = daysAgoIso(0)
  const series = buildDailySeries(
    [sale({ day: today, units: 1, revenue_cents: 1_000 })],
    [],
    7
  )
  assert.equal(series.length, 7)
  assert.equal(series[series.length - 1].day, today, 'ends today')
  assert.equal(series[0].revenueCents, 0, 'a day with no entries is zero, and present')
  assert.equal(series[series.length - 1].revenueCents, 1_000)
})

test('a loss is reported as a negative number, not clamped', () => {
  const s = computeProfit({
    sales: [sale({ units: 1, revenue_cents: 1_000, cogs_cents: 800 })],
    adMetrics: [ad({ spend_cents: 5_000 })],
    expenses: [],
  })
  assert.ok(s.netProfitCents < 0)
  assert.equal(s.netProfitCents, -4_800)
})
