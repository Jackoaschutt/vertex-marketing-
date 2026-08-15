import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeProfit, computeProductPnl, EMPTY_SUMMARY } from '../lib/commerce/analytics/profit'
import type { AdMetric, Expense, Order, OrderItem, Product } from '../lib/commerce/types'

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    order_number: 'VSP-1',
    customer_id: null,
    email: 'a@example.com',
    currency: 'USD',
    subtotal_cents: 10000,
    shipping_cents: 0,
    tax_cents: 0,
    discount_cents: 0,
    total_cents: 10000,
    payment_fee_cents: 320,
    cogs_cents: 3000,
    refund_cents: 0,
    status: 'delivered',
    attention_reason: null,
    shipping_address: {},
    attribution: {},
    stripe_session_id: null,
    stripe_payment_intent_id: null,
    placed_at: '2026-01-01T00:00:00.000Z',
    fulfilled_at: null,
    delivered_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

function item(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'i1',
    order_id: 'o1',
    product_id: 'p1',
    variant_id: 'v1',
    supplier_id: null,
    sku: 'SKU',
    title: 'Thing',
    quantity: 1,
    unit_price_cents: 10000,
    unit_cost_cents: 3000,
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const ad: AdMetric = {
  id: 'a1',
  product_id: 'p1',
  channel: 'meta',
  campaign_ref: 'c',
  day: '2026-01-01',
  impressions: 1000,
  clicks: 50,
  spend_cents: 4000,
  purchases: 1,
  revenue_cents: 10000,
  source: 'manual',
  created_at: '2026-01-01T00:00:00.000Z',
}

const expense: Expense = {
  id: 'e1',
  label: 'Software',
  category: 'software',
  amount_cents: 1000,
  day: '2026-01-01',
  recurring: true,
  created_at: '2026-01-01T00:00:00.000Z',
}

test('no data produces nulls, not zeroes, for every rate', () => {
  const s = computeProfit({ orders: [], items: [], adMetrics: [], expenses: [] })
  assert.equal(s.netProfitCents, 0)
  assert.equal(s.aovCents, null)
  assert.equal(s.roas, null)
  assert.equal(s.cpaCents, null)
  assert.equal(s.netMargin, null)
  assert.equal(s.refundRate, null)
  assert.deepEqual(s, { ...EMPTY_SUMMARY })
})

test('revenue is never reported as profit', () => {
  const s = computeProfit({
    orders: [order()],
    items: [item()],
    adMetrics: [ad],
    expenses: [expense],
  })
  assert.equal(s.grossRevenueCents, 10000)
  assert.equal(s.netRevenueCents, 10000)
  assert.equal(s.cogsCents, 3000)
  assert.equal(s.grossProfitCents, 7000)
  // 7000 gross − 320 fees − 4000 ads − 1000 expenses
  assert.equal(s.netProfitCents, 1680)
  assert.ok(s.netProfitCents < s.grossRevenueCents)
})

test('refunds reduce net revenue and show in the refund rate', () => {
  const s = computeProfit({
    orders: [order(), order({ id: 'o2', order_number: 'VSP-2', refund_cents: 10000 })],
    items: [item(), item({ id: 'i2', order_id: 'o2' })],
    adMetrics: [],
    expenses: [],
  })
  assert.equal(s.grossRevenueCents, 20000)
  assert.equal(s.refundsCents, 10000)
  assert.equal(s.netRevenueCents, 10000)
  assert.equal(s.refundRate, 0.5)
})

test('cancelled orders are excluded from revenue entirely', () => {
  const s = computeProfit({
    orders: [order({ status: 'cancelled' })],
    items: [item()],
    adMetrics: [],
    expenses: [],
  })
  assert.equal(s.orders, 0)
  assert.equal(s.grossRevenueCents, 0)
  assert.equal(s.cogsCents, 0)
})

test('ROAS and CPA use net revenue and real order counts', () => {
  const s = computeProfit({ orders: [order()], items: [item()], adMetrics: [ad], expenses: [] })
  assert.equal(s.roas, 10000 / 4000)
  assert.equal(s.cpaCents, 4000)
  assert.equal(s.aovCents, 10000)
})

test('per-product P&L subtracts that product’s own ad spend', () => {
  const product = {
    id: 'p1',
    name: 'Thing',
    status: 'winner',
    sessions_count: 100,
  } as unknown as Product
  const [pnl] = computeProductPnl([product], [order()], [item()], [ad])
  assert.equal(pnl.revenueCents, 10000)
  assert.equal(pnl.grossProfitCents, 7000)
  assert.equal(pnl.netProfitCents, 3000)
  assert.equal(pnl.roas, 2.5)
  assert.equal(pnl.conversionRate, 0.01)
})
