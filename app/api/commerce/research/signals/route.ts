import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { fail, handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { logEvent, saveSignal } from '@/lib/commerce/db/repo'
import {
  collectCompetition,
  collectTrend,
  isSerpApiConfigured,
  SignalError,
  type CollectedSignal,
} from '@/lib/commerce/research/signals'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/research/signals — admin.
 *
 * Collects real demand and competition data for a keyword. If SerpAPI is not
 * configured this returns 503 naming the missing variable rather than
 * producing a plausible-looking result: a fabricated trend would feed the
 * demand score and make an unvalidated candidate look validated.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    if (!isSerpApiConfigured()) {
      return fail(
        503,
        'SERPAPI_KEY is not set, so no demand data can be collected. Set it to turn this on, or score demand by hand and note where the number came from.'
      )
    }

    const body = await readJson(request)
    const v = new Validator(body)
    const keyword = v.string('keyword', { required: true, min: 2, max: 120 })
    const productId = v.string('productId', { max: 64 })
    v.done()

    // One failing collector must not lose the other's result.
    const [trend, competition] = await Promise.allSettled([
      collectTrend(keyword),
      collectCompetition(keyword),
    ])

    const collected: CollectedSignal[] = []
    const errors: string[] = []

    for (const outcome of [trend, competition]) {
      if (outcome.status === 'fulfilled') collected.push(outcome.value)
      else {
        const err = outcome.reason
        errors.push(
          err instanceof SignalError
            ? `${err.message}${err.hint ? ` — ${err.hint}` : ''}`
            : String(err)
        )
      }
    }

    if (collected.length === 0) {
      return fail(502, `No signal could be collected. ${errors.join(' ')}`)
    }

    for (const signal of collected) {
      await saveSignal({
        product_id: productId || null,
        keyword: signal.keyword,
        source: signal.source,
        payload: signal.payload,
        trend_direction: signal.trendDirection,
        trend_score: signal.trendScore,
        competition_count: signal.competitionCount,
        collected_at: new Date().toISOString(),
      })
    }

    await logEvent({
      kind: 'research.signals_collected',
      level: errors.length > 0 ? 'warn' : 'info',
      message: `${admin.email} collected ${collected.length} signal(s) for "${keyword}".`,
      product_id: productId || null,
      data: { keyword, errors },
    })

    return ok({ signals: collected, errors })
  } catch (err) {
    return handleError(err, 'research:signals')
  }
}
