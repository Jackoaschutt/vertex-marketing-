import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatMoney,
  grossMargin,
  paymentFee,
  percentOf,
  profitPerUnit,
  safeDivide,
  toCents,
} from '../lib/commerce/money'

test('toCents converts currency strings and numbers without float drift', () => {
  assert.equal(toCents('49.00'), 4900)
  assert.equal(toCents('$1,234.56'), 123456)
  assert.equal(toCents(19.99), 1999)
  assert.equal(toCents('0.1'), 10)
  // 0.1 + 0.2 style drift must never survive into a stored amount
  assert.equal(toCents(0.1 + 0.2), 30)
})

test('toCents is defensive about junk input', () => {
  assert.equal(toCents(''), 0)
  assert.equal(toCents('abc'), 0)
  assert.equal(toCents('.'), 0)
  assert.equal(toCents(Number.NaN), 0)
})

test('safeDivide returns null instead of Infinity or NaN', () => {
  assert.equal(safeDivide(10, 0), null)
  assert.equal(safeDivide(0, 0), null)
  assert.equal(safeDivide(Number.NaN, 5), null)
  assert.equal(safeDivide(10, 4), 2.5)
})

test('paymentFee matches the standard percentage-plus-fixed shape', () => {
  assert.equal(paymentFee(5000), percentOf(5000, 2.9) + 30)
  assert.equal(paymentFee(5000, 2.9, 30), 175)
  assert.equal(paymentFee(0), 0)
  assert.equal(paymentFee(-100), 0)
})

test('grossMargin accounts for landed shipping cost', () => {
  assert.equal(grossMargin(10000, 3000, 1000), 0.6)
  assert.equal(grossMargin(0, 100), null)
  assert.equal(profitPerUnit(4900, 1180, 420), 3300)
})

test('formatMoney never renders NaN', () => {
  assert.equal(formatMoney(Number.NaN), '$0.00')
  assert.equal(formatMoney(4900), '$49.00')
})
