import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { logEvent, upsertAdMetric } from '@/lib/commerce/db/repo'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/marketing/spend — admin.
 *
 * Manual ad-spend entry. This is the REAL path until a channel API client
 * exists; the figures it produces feed ROAS, CPA and net profit exactly as an
 * API-sourced row would. Upserted on (product, channel, campaign, day) so
 * re-entering a day corrects it rather than double-counting.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const productId = v.string('productId', { max: 64 })
    const channel = v.oneOf('channel', ['meta', 'tiktok', 'google', 'other'] as const, {
      required: true,
    })
    const campaignRef = v.string('campaignRef', { max: 120 })
    const day = v.string('day', { required: true, min: 10, max: 10 })
    const impressions = v.int('impressions', { min: 0 })
    const clicks = v.int('clicks', { min: 0 })
    const spendCents = v.int('spendCents', { required: true, min: 0 })
    const purchases = v.int('purchases', { min: 0 })
    const revenueCents = v.int('revenueCents', { min: 0 })

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) v.fail('day must be in YYYY-MM-DD format.')
    v.done()

    const metric = await upsertAdMetric({
      product_id: productId || null,
      channel,
      campaign_ref: campaignRef || `${channel}-manual`,
      day,
      impressions,
      clicks,
      spend_cents: spendCents,
      purchases,
      revenue_cents: revenueCents,
      source: 'manual',
    })

    await logEvent({
      kind: 'marketing.spend_recorded',
      message: `${admin.email} recorded ${channel} spend for ${day}.`,
      product_id: productId || null,
      data: { spendCents, channel, day },
    })

    return ok({ metric })
  } catch (err) {
    return handleError(err, 'marketing:spend')
  }
}
