import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EMPTY_INPUT,
  MAX_SCORE,
  SCORE_WEIGHTS,
  allowedTransitions,
  canTransition,
  computeComponents,
  isSellable,
  marginScore,
  scoreProduct,
  shippingScore,
  totalScore,
  type ScoreInput,
} from '../lib/commerce/research/scoring'

const perfect: ScoreInput = {
  ...EMPTY_INPUT,
  priceCents: 10000,
  costCents: 1500,
  shippingCostCents: 500,
  shipDaysMax: 4,
  searchDemand: 5,
  socialInterest: 5,
  marketSize: 5,
  competition: 5,
  saturation: 5,
  problemSeverity: 5,
  differentiation: 5,
  impulseBuy: 5,
  creativePotential: 5,
  brandability: 5,
  repeatPurchase: 5,
  refundRisk: 5,
  qualityRisk: 5,
  regulatoryRisk: 5,
}

test('the rubric weights sum to 100', () => {
  const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0)
  assert.equal(sum, MAX_SCORE)
})

test('a maximal candidate scores exactly 100 and no component exceeds its cap', () => {
  const components = computeComponents(perfect)
  assert.equal(totalScore(components), 100)
  assert.equal(components.demand_score, SCORE_WEIGHTS.demand)
  assert.equal(components.margin_score, SCORE_WEIGHTS.margin)
  assert.equal(components.risk_score, SCORE_WEIGHTS.risk)
})

test('an empty candidate earns nothing on any judged component', () => {
  const components = computeComponents(EMPTY_INPUT)
  // Shipping is derived from the default 14-day window rather than judged, so
  // it is the only component that can be non-zero with no signals entered.
  const judged = { ...components, shipping_score: 0 }
  assert.equal(totalScore(judged), 0)
  assert.equal(components.margin_score, 0)
  assert.equal(totalScore(components), components.shipping_score)
})

test('margin score is derived from real numbers, not judgement', () => {
  assert.equal(marginScore(10000, 1500, 500), 15) // 80% margin
  assert.equal(marginScore(10000, 4000, 500), 10) // 55%
  assert.equal(marginScore(10000, 6500, 500), 2) //  30%
  assert.equal(marginScore(10000, 9000, 500), 0) //   5%
  assert.equal(marginScore(0, 100, 0), 0)
})

test('shipping score penalises long transit and heavy shipping cost share', () => {
  assert.equal(shippingScore(4, 100, 10000), 5)
  assert.equal(shippingScore(30, 100, 10000), 0)
  // Same fast transit, but shipping is 30% of the sale price.
  assert.equal(shippingScore(4, 3000, 10000), 3)
})

test('a thin-margin product is a hard skip regardless of other signals', () => {
  const thin: ScoreInput = { ...perfect, costCents: 6800, shippingCostCents: 0 } // 32% margin
  const result = scoreProduct(thin)
  assert.equal(result.verdict, 'skip')
  assert.equal(result.suggestedStatus, 'rejected')
  assert.ok(result.reasons.some((r) => r.includes('margin')))
})

test('a strong candidate is suggested for validation, never straight to the store', () => {
  const result = scoreProduct(perfect)
  assert.equal(result.verdict, 'strong')
  assert.equal(result.suggestedStatus, 'validation')
  assert.equal(isSellable('validation'), false)
})

test('lifecycle transitions are constrained', () => {
  assert.ok(canTransition('researching', 'validation'))
  assert.ok(canTransition('testing', 'winner'))
  // A candidate cannot skip validation and approval to reach the storefront.
  assert.equal(canTransition('researching', 'winner'), false)
  assert.equal(canTransition('researching', 'testing'), false)
  assert.equal(canTransition('rejected', 'winner'), false)
  assert.deepEqual(allowedTransitions('approved'), ['testing', 'rejected'])
})

test('only post-approval statuses are sellable', () => {
  assert.equal(isSellable('researching'), false)
  assert.equal(isSellable('rejected'), false)
  assert.equal(isSellable('approved'), true)
  assert.equal(isSellable('winner'), true)
  assert.equal(isSellable('scaling'), true)
  assert.equal(isSellable('loser'), false)
})
