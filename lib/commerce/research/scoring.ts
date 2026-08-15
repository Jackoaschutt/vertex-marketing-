/**
 * Product research scoring — the 0–100 rubric.
 *
 *   Demand           0–20
 *   Margin           0–15   (computed from real numbers, not judged)
 *   Competition      0–15
 *   Problem/Solution 0–15
 *   Creative         0–10
 *   Brandability     0–10
 *   Shipping         0–5    (computed from real numbers, not judged)
 *   Repeat purchase  0–5
 *   Risk             0–5    (higher = lower risk)
 *   ────────────────────────
 *   Total            0–100
 *
 * Judgement inputs are 0–5 signals supplied by the operator (or, later, by a
 * data source). Margin and shipping are derived arithmetically from price,
 * cost and transit time so those two components cannot be talked up.
 *
 * A high score does NOT publish a product. Scoring only informs the lifecycle
 * status, and every status transition is an explicit operator action.
 */

import { grossMargin } from '../money'
import type { ProductStatus, ScoreComponents } from '../types'

export const SCORE_WEIGHTS = {
  demand: 20,
  margin: 15,
  competition: 15,
  problem: 15,
  creative: 10,
  brandability: 10,
  shipping: 5,
  repeat: 5,
  risk: 5,
} as const

export const MAX_SCORE = 100

/** Every judgement signal is 0–5. Higher is always better for the business. */
export interface ScoreInput {
  // economics (real numbers)
  priceCents: number
  costCents: number
  shippingCostCents: number
  shipDaysMax: number

  // demand
  searchDemand: number //  0 none        → 5 strong, growing search volume
  socialInterest: number //0 none        → 5 actively trending on short-form
  marketSize: number //    0 tiny niche  → 5 large addressable market

  // competition
  competition: number //   0 saturated   → 5 few credible sellers
  saturation: number //    0 everywhere  → 5 rarely advertised

  // problem / solution
  problemSeverity: number //0 nice-to-have → 5 acute, recurring problem
  differentiation: number //0 commodity    → 5 hard to copy
  impulseBuy: number //     0 considered   → 5 instant decision

  // creative & brand
  creativePotential: number // 0 unfilmable → 5 obvious demo, strong before/after
  brandability: number //      0 generic    → 5 anchors a real brand

  // retention
  repeatPurchase: number // 0 one-off → 5 consumable or naturally repeated

  // risk (higher = safer)
  refundRisk: number //     0 high returns   → 5 rarely returned
  qualityRisk: number //    0 fragile/QC     → 5 simple, robust
  regulatoryRisk: number // 0 restricted     → 5 unrestricted, ad-platform safe
}

export const EMPTY_INPUT: ScoreInput = {
  priceCents: 0,
  costCents: 0,
  shippingCostCents: 0,
  shipDaysMax: 14,
  searchDemand: 0,
  socialInterest: 0,
  marketSize: 0,
  competition: 0,
  saturation: 0,
  problemSeverity: 0,
  differentiation: 0,
  impulseBuy: 0,
  creativePotential: 0,
  brandability: 0,
  repeatPurchase: 0,
  refundRisk: 0,
  qualityRisk: 0,
  regulatoryRisk: 0,
}

function clamp05(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(5, n))
}

/** Average a set of 0–5 signals and scale onto a 0–max band. */
function band(signals: number[], max: number): number {
  const vals = signals.map(clamp05)
  const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
  return Math.round((avg / 5) * max)
}

/**
 * Margin score from the real gross margin, landed cost included.
 * Below 40% a dropshipping product cannot absorb ad costs, so it scores near zero.
 */
export function marginScore(priceCents: number, costCents: number, shipCents: number): number {
  const m = grossMargin(priceCents, costCents, shipCents)
  if (m === null) return 0
  const table: [number, number][] = [
    [0.75, 15],
    [0.7, 14],
    [0.65, 13],
    [0.6, 12],
    [0.55, 10],
    [0.5, 8],
    [0.45, 6],
    [0.4, 4],
    [0.3, 2],
    [0.2, 1],
  ]
  for (const [threshold, score] of table) if (m >= threshold) return score
  return 0
}

/**
 * Shipping score from worst-case transit time, penalised when shipping cost is
 * a large share of the sale price.
 */
export function shippingScore(
  shipDaysMax: number,
  shippingCostCents: number,
  priceCents: number
): number {
  let score: number
  if (shipDaysMax <= 5) score = 5
  else if (shipDaysMax <= 8) score = 4
  else if (shipDaysMax <= 12) score = 3
  else if (shipDaysMax <= 18) score = 2
  else if (shipDaysMax <= 25) score = 1
  else score = 0

  if (priceCents > 0) {
    const share = shippingCostCents / priceCents
    if (share > 0.25) score -= 2
    else if (share > 0.15) score -= 1
  }
  return Math.max(0, Math.min(5, score))
}

export function computeComponents(input: ScoreInput): ScoreComponents {
  return {
    demand_score: band([input.searchDemand, input.socialInterest, input.marketSize], SCORE_WEIGHTS.demand),
    margin_score: marginScore(input.priceCents, input.costCents, input.shippingCostCents),
    competition_score: band([input.competition, input.saturation], SCORE_WEIGHTS.competition),
    problem_score: band(
      [input.problemSeverity, input.differentiation, input.impulseBuy],
      SCORE_WEIGHTS.problem
    ),
    creative_score: band([input.creativePotential], SCORE_WEIGHTS.creative),
    brandability_score: band([input.brandability, input.differentiation], SCORE_WEIGHTS.brandability),
    shipping_score: shippingScore(input.shipDaysMax, input.shippingCostCents, input.priceCents),
    repeat_score: band([input.repeatPurchase], SCORE_WEIGHTS.repeat),
    risk_score: band(
      [input.refundRisk, input.qualityRisk, input.regulatoryRisk],
      SCORE_WEIGHTS.risk
    ),
  }
}

export function totalScore(c: ScoreComponents): number {
  return (
    c.demand_score +
    c.margin_score +
    c.competition_score +
    c.problem_score +
    c.creative_score +
    c.brandability_score +
    c.shipping_score +
    c.repeat_score +
    c.risk_score
  )
}

export interface ScoreResult {
  components: ScoreComponents
  total: number
  verdict: 'strong' | 'viable' | 'marginal' | 'skip'
  reasons: string[]
  suggestedStatus: ProductStatus
}

export function scoreProduct(input: ScoreInput): ScoreResult {
  const components = computeComponents(input)
  const total = totalScore(components)

  const reasons: string[] = []
  const m = grossMargin(input.priceCents, input.costCents, input.shippingCostCents)
  if (m !== null && m < 0.5) {
    reasons.push(
      `Gross margin is ${(m * 100).toFixed(0)}%. Below 50% there is little room for ad spend at a typical CPA.`
    )
  }
  if (components.shipping_score <= 1) {
    reasons.push(`Worst-case transit is ${input.shipDaysMax} days. Long waits drive refunds and chargebacks.`)
  }
  if (components.competition_score <= 4) reasons.push('The category looks saturated — expect rising CPMs.')
  if (components.risk_score <= 1) reasons.push('Risk signals are poor (returns, quality, or ad-platform restrictions).')
  if (components.demand_score <= 6) reasons.push('Demand signals are weak — there may be no audience to buy this.')
  if (components.creative_score <= 3) reasons.push('Hard to demonstrate on video, which limits paid social.')

  // Hard gates: some failures should sink a product regardless of total score.
  const hardFail =
    components.margin_score === 0 ||
    components.risk_score === 0 ||
    (m !== null && m < 0.35)

  let verdict: ScoreResult['verdict']
  if (hardFail) verdict = 'skip'
  else if (total >= 75) verdict = 'strong'
  else if (total >= 60) verdict = 'viable'
  else if (total >= 45) verdict = 'marginal'
  else verdict = 'skip'

  const suggestedStatus: ProductStatus =
    verdict === 'strong' ? 'validation' : verdict === 'viable' ? 'validation' : verdict === 'marginal' ? 'researching' : 'rejected'

  if (reasons.length === 0) reasons.push('No blocking issues found in the scored signals.')

  return { components, total, verdict, reasons, suggestedStatus }
}

// --- Lifecycle -------------------------------------------------------------

export const STATUS_ORDER: ProductStatus[] = [
  'researching',
  'validation',
  'approved',
  'rejected',
  'testing',
  'winner',
  'loser',
  'scaling',
]

/**
 * Legal status transitions. A high score can never move a product into the
 * catalogue on its own — approval is always an explicit action.
 */
const TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  researching: ['validation', 'rejected'],
  validation: ['approved', 'rejected', 'researching'],
  approved: ['testing', 'rejected'],
  rejected: ['researching'],
  testing: ['winner', 'loser', 'rejected'],
  winner: ['scaling', 'loser'],
  loser: ['rejected', 'testing'],
  scaling: ['winner', 'loser'],
}

export function canTransition(from: ProductStatus, to: ProductStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function allowedTransitions(from: ProductStatus): ProductStatus[] {
  return TRANSITIONS[from] ?? []
}

/** Statuses whose products may be shown in the storefront. */
export const SELLABLE_STATUSES: ProductStatus[] = ['approved', 'testing', 'winner', 'scaling']

export function isSellable(status: ProductStatus): boolean {
  return SELLABLE_STATUSES.includes(status)
}

export const SCORE_FIELDS: {
  key: keyof ScoreInput
  label: string
  hint: string
  group: string
}[] = [
  { key: 'searchDemand', label: 'Search demand', hint: '0 = nobody searches this · 5 = strong and growing', group: 'Demand' },
  { key: 'socialInterest', label: 'Social interest', hint: '0 = no short-form traction · 5 = actively trending', group: 'Demand' },
  { key: 'marketSize', label: 'Market size', hint: '0 = tiny niche · 5 = large addressable market', group: 'Demand' },
  { key: 'competition', label: 'Competition', hint: '0 = many strong sellers · 5 = few credible sellers', group: 'Competition' },
  { key: 'saturation', label: 'Ad saturation', hint: '0 = advertised everywhere · 5 = rarely advertised', group: 'Competition' },
  { key: 'problemSeverity', label: 'Problem severity', hint: '0 = nice to have · 5 = acute and recurring', group: 'Problem' },
  { key: 'differentiation', label: 'Differentiation', hint: '0 = commodity · 5 = genuinely hard to copy', group: 'Problem' },
  { key: 'impulseBuy', label: 'Impulse potential', hint: '0 = long consideration · 5 = instant decision', group: 'Problem' },
  { key: 'creativePotential', label: 'Creative potential', hint: '0 = unfilmable · 5 = obvious demo or before/after', group: 'Creative' },
  { key: 'brandability', label: 'Brandability', hint: '0 = generic · 5 = could anchor a real brand', group: 'Brand' },
  { key: 'repeatPurchase', label: 'Repeat purchase', hint: '0 = one-off · 5 = consumable or naturally repeated', group: 'Retention' },
  { key: 'refundRisk', label: 'Refund safety', hint: '0 = high return rate · 5 = rarely returned', group: 'Risk' },
  { key: 'qualityRisk', label: 'Quality safety', hint: '0 = fragile or QC-prone · 5 = simple and robust', group: 'Risk' },
  { key: 'regulatoryRisk', label: 'Regulatory safety', hint: '0 = restricted category · 5 = unrestricted and ad-safe', group: 'Risk' },
]
