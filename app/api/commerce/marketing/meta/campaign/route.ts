import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { absoluteUrl, storeUrl } from '@/lib/commerce/brand'
import { fail, handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { getProductRow, logEvent } from '@/lib/commerce/db/repo'
import { isSellable } from '@/lib/commerce/research/scoring'
import {
  MetaAdsClient,
  MetaApiError,
  MetaNotConfiguredError,
} from '@/lib/commerce/marketing/adapter-meta'
import { mapCampaignToProduct } from '@/lib/commerce/marketing/import'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/commerce/marketing/meta/campaign — admin.
 *
 * Creates campaign → ad set → creative → ad for one product, always PAUSED,
 * and records the campaign→product mapping so imported spend lands on the
 * right P&L row.
 *
 * Guards that server.py did not have:
 *   - refuses to advertise a product that is not published and sellable
 *   - resolves interest names to real Meta targeting IDs (names alone are
 *     ignored by Meta, which silently produces a fully broad campaign)
 *   - never returns success unless every one of the four objects was created
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const productId = v.string('productId', { required: true })
    const dailyBudgetCents = v.int('dailyBudgetCents', { required: true, min: 100, max: 10_000_00 })
    const headline = v.string('headline', { required: true, min: 3, max: 40 })
    const adBody = v.string('body', { required: true, min: 10, max: 500 })
    const interests = v.stringArray('interests', 10)
    const countries = v.stringArray('countries', 25)
    const ageMin = v.int('ageMin', { min: 13, max: 65, default: 18 })
    const ageMax = v.int('ageMax', { min: 13, max: 65, default: 55 })
    if (ageMin > ageMax) v.fail('ageMin must not be greater than ageMax.')
    v.done()

    const product = await getProductRow(productId)
    if (!product) return fail(404, 'Product not found.')

    // Do not let the system spend money driving traffic to a page that 404s.
    if (!product.published || !isSellable(product.status)) {
      return fail(
        409,
        `"${product.name}" is not live (status ${product.status}, published ${product.published}). Publish it before advertising it — otherwise the ads would send paid traffic to a page that is not for sale.`
      )
    }

    const client = new MetaAdsClient()

    try {
      const result = await client.createCampaign({
        productName: product.name,
        productSlug: product.slug,
        destinationUrl: absoluteUrl(storeUrl(`/product/${product.slug}?utm_source=meta&utm_medium=paid_social&utm_campaign=${product.slug}`)),
        dailyBudgetCents,
        headline,
        body: adBody,
        interests,
        countries: countries.length ? countries : undefined,
        ageMin,
        ageMax,
      })

      await mapCampaignToProduct(result.campaignId, product.id)

      await logEvent({
        kind: 'marketing.campaign_created',
        message: `${admin.email} created a PAUSED Meta campaign for "${product.name}" (${result.campaignId}).`,
        product_id: product.id,
        data: {
          campaignId: result.campaignId,
          dailyBudgetCents,
          resolvedInterests: result.resolvedInterests,
          unresolvedInterests: result.unresolvedInterests,
        },
      })

      return ok({
        ...result,
        note: 'The campaign, ad set and ad were all created PAUSED. Review the creative in Ads Manager and activate it there — this system will not start spending on its own.',
        warning:
          result.unresolvedInterests.length > 0
            ? `Meta had no targeting interest matching: ${result.unresolvedInterests.join(', ')}. Those were dropped rather than sent as unusable names — the ad set targets only the interests that resolved.`
            : undefined,
      })
    } catch (err) {
      if (err instanceof MetaApiError) {
        return fail(502, `Meta rejected the campaign: ${err.message}`, {
          code: err.code,
          subcode: err.subcode,
          hint: err.hint,
        })
      }
      if (err instanceof MetaNotConfiguredError) {
        return fail(503, err.message, { requires: err.requires })
      }
      throw err
    }
  } catch (err) {
    return handleError(err, 'marketing:meta:campaign')
  }
}
