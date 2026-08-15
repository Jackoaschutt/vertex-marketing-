import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { EMPTY_INPUT, scoreProduct, type ScoreInput } from '@/lib/commerce/research/scoring'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/research/score — admin.
 * Stateless. Scores a candidate without storing anything, so the research
 * console can show a live breakdown as the operator types.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const input: ScoreInput = {
      ...EMPTY_INPUT,
      priceCents: v.int('priceCents', { min: 0 }),
      costCents: v.int('costCents', { min: 0 }),
      shippingCostCents: v.int('shippingCostCents', { min: 0 }),
      shipDaysMax: v.int('shipDaysMax', { min: 0, max: 180, default: 14 }),
    }

    for (const key of [
      'searchDemand',
      'socialInterest',
      'marketSize',
      'competition',
      'saturation',
      'problemSeverity',
      'differentiation',
      'impulseBuy',
      'creativePotential',
      'brandability',
      'repeatPurchase',
      'refundRisk',
      'qualityRisk',
      'regulatoryRisk',
    ] as const) {
      input[key] = v.int(key, { min: 0, max: 5 })
    }
    v.done()

    return ok(scoreProduct(input))
  } catch (err) {
    return handleError(err, 'research:score')
  }
}
