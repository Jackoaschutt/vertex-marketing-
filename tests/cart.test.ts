import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { __setDriver } from '../lib/commerce/db'
import { MemoryDriver } from '../lib/commerce/db/driver-memory'
import { buildSeed } from '../lib/commerce/db/seed'
import { priceCart, shippingFor } from '../lib/commerce/cart'
import { updateProduct } from '../lib/commerce/db/repo'
import { brand } from '../lib/commerce/brand'

const HALO_CHARCOAL = '30000000-0000-4000-8000-000000000001'
const HALO_SAND = '30000000-0000-4000-8000-000000000002'
const RIDGE = '30000000-0000-4000-8000-000000000005' // unpublished product (loser)
const HALO_PRODUCT = '20000000-0000-4000-8000-000000000001'

beforeEach(() => {
  __setDriver(new MemoryDriver(buildSeed()))
})

test('an empty cart prices to zero without touching the database', async () => {
  const cart = await priceCart([])
  assert.equal(cart.lines.length, 0)
  assert.equal(cart.totalCents, 0)
  assert.equal(cart.hasUnavailable, false)
})

test('prices come from the database, not the client', async () => {
  const cart = await priceCart([{ variantId: HALO_CHARCOAL, qty: 1 }])
  assert.equal(cart.lines.length, 1)
  assert.equal(cart.lines[0].unitPriceCents, 4900)
  assert.equal(cart.lines[0].lineTotalCents, 4900)
  assert.equal(cart.subtotalCents, 4900)
})

test('duplicate lines are collapsed and quantity is clamped', async () => {
  const cart = await priceCart([
    { variantId: HALO_CHARCOAL, qty: 2 },
    { variantId: HALO_CHARCOAL, qty: 3 },
  ])
  assert.equal(cart.lines.length, 1)
  assert.equal(cart.lines[0].qty, 5)

  const clamped = await priceCart([{ variantId: HALO_CHARCOAL, qty: 999 }])
  assert.equal(clamped.lines[0].qty, 20)
})

test('shipping is free above the threshold and flat below it', async () => {
  assert.equal(shippingFor(0), 0)
  assert.equal(shippingFor(brand.shipping.freeThresholdCents - 1), brand.shipping.flatRateCents)
  assert.equal(shippingFor(brand.shipping.freeThresholdCents), 0)

  const small = await priceCart([{ variantId: HALO_CHARCOAL, qty: 1 }])
  assert.equal(small.shippingCents, brand.shipping.flatRateCents)
  assert.equal(small.totalCents, 4900 + brand.shipping.flatRateCents)

  const large = await priceCart([{ variantId: HALO_CHARCOAL, qty: 2 }])
  assert.equal(large.shippingCents, 0)
  assert.equal(large.totalCents, 9800)
})

test('unpublished products cannot be bought and are excluded from the total', async () => {
  const cart = await priceCart([
    { variantId: HALO_CHARCOAL, qty: 1 },
    { variantId: RIDGE, qty: 1 },
  ])
  const ridge = cart.lines.find((l) => l.variantId === RIDGE)
  assert.ok(ridge)
  assert.equal(ridge.available, false)
  assert.equal(cart.hasUnavailable, true)
  // Only the available line contributes.
  assert.equal(cart.subtotalCents, 4900)
})

test('unknown variant ids are reported rather than silently dropped', async () => {
  const cart = await priceCart([{ variantId: 'does-not-exist', qty: 1 }])
  assert.equal(cart.lines.length, 1)
  assert.equal(cart.lines[0].available, false)
  assert.equal(cart.subtotalCents, 0)
})

test('quantity above supplier stock is refused with the real remaining count', async () => {
  // The seeded Sand variant has 7 units.
  const cart = await priceCart([{ variantId: HALO_SAND, qty: 9 }])
  assert.equal(cart.lines[0].available, false)
  assert.ok(cart.lines[0].reason?.includes('7'))
})

test('unpublishing a product immediately removes it from the cart total', async () => {
  await updateProduct(HALO_PRODUCT, { published: false })
  const cart = await priceCart([{ variantId: HALO_CHARCOAL, qty: 1 }])
  assert.equal(cart.lines[0].available, false)
  assert.equal(cart.totalCents, 0)
})
