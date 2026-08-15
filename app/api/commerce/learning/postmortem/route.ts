import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { fail, handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import {
  getProductRow,
  listAdMetrics,
  listSalesForProduct,
  logEvent,
  savePostmortem,
} from '@/lib/commerce/db/repo'
import { computeProfit } from '@/lib/commerce/analytics/profit'
import { FACTORS } from '@/lib/commerce/research/factors'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/learning/postmortem — admin.
 *
 * The figures are snapshotted here rather than read at display time, so the
 * story and the numbers it was written about can never drift apart. Factors
 * come from a fixed list because free text cannot be counted, and counting is
 * the entire point of writing them down.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const productId = v.string('productId', { required: true, max: 64 })
    const outcome = v.oneOf('outcome', ['winner', 'loser', 'undecided'] as const, { required: true })
    const whatHappened = v.string('whatHappened', { max: 5000 })
    const whatWorked = v.string('whatWorked', { max: 5000 })
    const whatFailed = v.string('whatFailed', { max: 5000 })
    const nextTime = v.string('nextTime', { max: 5000 })
    const factorsRaw = v.string('factors', { max: 500 })
    v.done()

    const product = await getProductRow(productId)
    if (!product) return fail(404, 'Product not found.')

    const known = new Set(FACTORS.map((f) => f.key))
    const factors = factorsRaw
      .split(',')
      .map((f) => f.trim())
      .filter((f) => known.has(f))

    const [sales, adMetrics] = await Promise.all([
      listSalesForProduct(productId),
      listAdMetrics(),
    ])
    const summary = computeProfit({
      sales,
      adMetrics: adMetrics.filter((m) => m.product_id === productId),
      expenses: [],
    })

    const postmortem = await savePostmortem({
      product_id: productId,
      outcome,
      what_happened: whatHappened,
      what_worked: whatWorked,
      what_failed: whatFailed,
      next_time: nextTime,
      factors,
      snapshot: {
        writtenAt: new Date().toISOString(),
        status: product.status,
        score: product.product_score,
        units: summary.units,
        revenueCents: summary.revenueCents,
        adSpendCents: summary.adSpendCents,
        netProfitCents: summary.netProfitCents,
        roas: summary.roas,
        grossMargin: summary.grossMargin,
      },
    })

    await logEvent({
      kind: 'postmortem.written',
      message: `${admin.email} wrote the post-mortem for "${product.name}" (${outcome}).`,
      product_id: productId,
      data: { outcome, factors },
    })

    return ok({ postmortem })
  } catch (err) {
    return handleError(err, 'learning:postmortem')
  }
}
