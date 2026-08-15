import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { fail, handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { getProductRow, logEvent } from '@/lib/commerce/db/repo'
import { getCampaignMap, mapCampaignToProduct, unmapCampaign } from '@/lib/commerce/marketing/import'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/marketing/meta/map — admin.
 * Body: { campaignId, productId }  ·  { campaignId, productId: null } to unmap.
 *
 * Attributes a campaign that already exists in Ads Manager to a product, for
 * campaigns not created through this system and not carrying a [vsp:<slug>]
 * marker in their name. Applies to future imports; re-run the import for the
 * period you want re-attributed.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)
    const campaignId = v.string('campaignId', { required: true, min: 1, max: 64 })
    const raw = body as Record<string, unknown>
    const clearing = raw.productId === null || raw.productId === ''
    const productId = clearing ? '' : v.string('productId', { required: true })
    v.done()

    if (clearing) {
      await unmapCampaign(campaignId)
      await logEvent({
        kind: 'marketing.campaign_unmapped',
        message: `${admin.email} unmapped Meta campaign ${campaignId}.`,
      })
      return ok({ campaignId, productId: null, map: await getCampaignMap() })
    }

    const product = await getProductRow(productId)
    if (!product) return fail(404, 'Product not found.')

    await mapCampaignToProduct(campaignId, productId)
    await logEvent({
      kind: 'marketing.campaign_mapped',
      message: `${admin.email} mapped Meta campaign ${campaignId} to "${product.name}".`,
      product_id: productId,
    })

    return ok({
      campaignId,
      productId,
      productName: product.name,
      map: await getCampaignMap(),
      note: 'Applies to future imports. Re-import the period you want re-attributed.',
    })
  } catch (err) {
    return handleError(err, 'marketing:meta:map')
  }
}
