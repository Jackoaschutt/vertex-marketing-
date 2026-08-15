import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { __setDriver } from '../lib/commerce/db'
import { MemoryDriver } from '../lib/commerce/db/driver-memory'
import { buildSeed } from '../lib/commerce/db/seed'
import { createOrderFromCart } from '../lib/commerce/orders/create'
import { processOrder, generateOrderNumber } from '../lib/commerce/orders/pipeline'
import { getOrder, listEvents, listFulfillments, listOrderItems } from '../lib/commerce/db/repo'

const HALO_CHARCOAL = '30000000-0000-4000-8000-000000000001'
const UMBRA = '30000000-0000-4000-8000-000000000004' // mapped to the second supplier

const goodAddress = {
  name: 'Test Buyer',
  line1: '1 Example Street',
  city: 'Portland',
  state: 'OR',
  postal_code: '97205',
  country: 'US',
}

beforeEach(() => {
  __setDriver(new MemoryDriver(buildSeed()))
})

test('order numbers are unique and prefixed', () => {
  const a = generateOrderNumber(1)
  const b = generateOrderNumber(2)
  assert.match(a, /^VSP-[0-9A-Z]+$/)
  assert.notEqual(a, b)
})

test('an order captures a cost snapshot so later price edits cannot rewrite history', async () => {
  const order = await createOrderFromCart({
    lines: [{ variantId: HALO_CHARCOAL, qty: 2 }],
    email: 'buyer@example.com',
    shippingAddress: goodAddress,
  })
  const items = await listOrderItems(order.id)
  assert.equal(items.length, 1)
  assert.equal(items[0].unit_price_cents, 4900)
  assert.equal(items[0].unit_cost_cents, 1180)
  assert.equal(order.cogs_cents, 2360)
  assert.equal(order.subtotal_cents, 9800)
  assert.ok(order.payment_fee_cents > 0)
})

test('order creation is idempotent on the Stripe session id', async () => {
  const first = await createOrderFromCart({
    lines: [{ variantId: HALO_CHARCOAL, qty: 1 }],
    email: 'buyer@example.com',
    shippingAddress: goodAddress,
    stripeSessionId: 'cs_test_1',
  })
  const second = await createOrderFromCart({
    lines: [{ variantId: HALO_CHARCOAL, qty: 1 }],
    email: 'buyer@example.com',
    shippingAddress: goodAddress,
    stripeSessionId: 'cs_test_1',
  })
  assert.equal(first.id, second.id)
})

test('a valid order is submitted to the supplier and recorded', async () => {
  const order = await createOrderFromCart({
    lines: [{ variantId: HALO_CHARCOAL, qty: 1 }],
    email: 'buyer@example.com',
    shippingAddress: goodAddress,
  })

  const result = await processOrder(order.id)
  assert.equal(result.failures.length, 0)
  assert.equal(result.submitted, 1)
  assert.equal(result.status, 'submitted')

  const fulfillments = await listFulfillments(order.id)
  assert.equal(fulfillments.length, 1)
  assert.equal(fulfillments[0].status, 'submitted')
  assert.ok(fulfillments[0].supplier_ref)
})

test('items from different suppliers are split into separate supplier orders', async () => {
  const order = await createOrderFromCart({
    lines: [
      { variantId: HALO_CHARCOAL, qty: 1 },
      { variantId: UMBRA, qty: 1 },
    ],
    email: 'buyer@example.com',
    shippingAddress: goodAddress,
  })

  const result = await processOrder(order.id)
  assert.equal(result.submitted, 2)

  const fulfillments = await listFulfillments(order.id)
  assert.equal(fulfillments.length, 2)
  assert.equal(new Set(fulfillments.map((f) => f.supplier_id)).size, 2)
})

test('an incomplete shipping address stops the order before the supplier is called', async () => {
  const order = await createOrderFromCart({
    lines: [{ variantId: HALO_CHARCOAL, qty: 1 }],
    email: 'buyer@example.com',
    shippingAddress: { name: 'No Address' },
  })

  const result = await processOrder(order.id)
  assert.equal(result.status, 'needs_attention')

  const stored = await getOrder(order.id)
  assert.equal(stored?.status, 'needs_attention')
  assert.ok(stored?.attention_reason?.includes('line1'))
  assert.equal((await listFulfillments(order.id)).length, 0)
})

test('a supplier rejection never reports success — it lands in needs_attention with the reason', async () => {
  const order = await createOrderFromCart({
    lines: [{ variantId: HALO_CHARCOAL, qty: 1 }],
    email: 'buyer@example.com',
    // The mock supplier rejects address lines longer than 35 characters.
    shippingAddress: { ...goodAddress, line1: 'A very long street address that exceeds the supplier limit' },
  })

  const result = await processOrder(order.id)
  assert.equal(result.failures.length, 1)
  assert.equal(result.status, 'needs_attention')

  const stored = await getOrder(order.id)
  assert.equal(stored?.status, 'needs_attention')
  assert.ok(stored?.attention_reason)

  const fulfillments = await listFulfillments(order.id)
  assert.equal(fulfillments[0].status, 'failed')
  assert.ok(fulfillments[0].error_message)

  // The failure is logged at error level rather than swallowed.
  const errors = await listEvents(50, 'error')
  assert.ok(errors.some((e) => e.order_id === order.id))
})

test('retrying a successful order does not submit it twice', async () => {
  const order = await createOrderFromCart({
    lines: [{ variantId: HALO_CHARCOAL, qty: 1 }],
    email: 'buyer@example.com',
    shippingAddress: goodAddress,
  })

  const first = await processOrder(order.id)
  assert.equal(first.submitted, 1)

  const second = await processOrder(order.id)
  assert.equal(second.submitted, 0)
  assert.equal(second.skipped, 1)
  assert.equal((await listFulfillments(order.id)).length, 1)
})

test('a failed order can be retried after the address is corrected', async () => {
  const order = await createOrderFromCart({
    lines: [{ variantId: HALO_CHARCOAL, qty: 1 }],
    email: 'buyer@example.com',
    shippingAddress: { ...goodAddress, line1: 'A very long street address that exceeds the supplier limit' },
  })
  await processOrder(order.id)
  assert.equal((await getOrder(order.id))?.status, 'needs_attention')

  const { updateOrder } = await import('../lib/commerce/db/repo')
  await updateOrder(order.id, { shipping_address: goodAddress })

  const retry = await processOrder(order.id)
  assert.equal(retry.failures.length, 0)
  assert.equal(retry.submitted, 1)
  // The failed fulfilment row is reused rather than duplicated.
  assert.equal((await listFulfillments(order.id)).length, 1)
  assert.equal((await getOrder(order.id))?.status, 'submitted')
})
