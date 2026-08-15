/**
 * Ad-metric import.
 *
 * Pulls daily performance from an ad channel and lands it in ds_ad_metrics so
 * the profit engine treats it exactly like manually entered spend.
 *
 * Attribution back to a product is the hard part — Meta has no idea what our
 * product ids are. Two mechanisms, in priority order:
 *
 *   1. An explicit campaign→product map in ds_settings.meta_campaign_map,
 *      written automatically when a campaign is launched from /ops.
 *   2. A `[vsp:<product-slug>]` marker in the campaign name, so a campaign
 *      created by hand in Ads Manager can still be attributed.
 *
 * Anything that matches neither is imported with product_id = null. It still
 * counts toward total ad spend and account-level net profit — it simply cannot
 * be charged to one product's P&L. Unattributed rows are reported back so the
 * operator can fix the campaign name rather than wonder where the money went.
 */

import { getSetting, listProducts, logEvent, setSetting, upsertAdMetric } from '../db/repo'
import { MetaAdsClient, type MetaCampaign } from './adapter-meta'
import type { ChannelDailyMetric } from './channels'

export const CAMPAIGN_MAP_KEY = 'meta_campaign_map'

export type CampaignMap = Record<string, string> // campaignId -> productId

export interface ImportSummary {
  channel: string
  from: string
  to: string
  rowsFetched: number
  rowsWritten: number
  attributed: number
  unattributed: number
  unattributedCampaigns: { campaignRef: string; spendCents: number }[]
  spendCents: number
  purchases: number
  revenueCents: number
}

export async function getCampaignMap(): Promise<CampaignMap> {
  return getSetting<CampaignMap>(CAMPAIGN_MAP_KEY, {})
}

export async function mapCampaignToProduct(campaignId: string, productId: string): Promise<void> {
  const map = await getCampaignMap()
  map[campaignId] = productId
  await setSetting(CAMPAIGN_MAP_KEY, map)
}

export async function unmapCampaign(campaignId: string): Promise<void> {
  const map = await getCampaignMap()
  delete map[campaignId]
  await setSetting(CAMPAIGN_MAP_KEY, map)
}

/**
 * Resolves each metric row to a product id. Pure apart from its inputs, so the
 * precedence rules are unit-testable without a network or a database.
 */
export function attributeRows(
  rows: ChannelDailyMetric[],
  campaignMap: CampaignMap,
  productIdBySlug: Map<string, string>
): { row: ChannelDailyMetric; productId: string | null }[] {
  return rows.map((row) => {
    const explicit = campaignMap[row.campaignRef]
    if (explicit) return { row, productId: explicit }
    const bySlug = row.productRef ? productIdBySlug.get(row.productRef) : undefined
    return { row, productId: bySlug ?? null }
  })
}

export async function importMetaMetrics(from: string, to: string): Promise<ImportSummary> {
  const client = new MetaAdsClient()
  const rows = await client.fetchDailyMetrics(from, to)

  const [campaignMap, products] = await Promise.all([getCampaignMap(), listProducts({})])
  const productIdBySlug = new Map(products.map((p) => [p.slug, p.id]))

  const attributed = attributeRows(rows, campaignMap, productIdBySlug)

  let rowsWritten = 0
  let spendCents = 0
  let purchases = 0
  let revenueCents = 0
  const unattributedSpend = new Map<string, number>()

  for (const { row, productId } of attributed) {
    if (!row.day) continue // a row with no date cannot be keyed; skip rather than guess

    await upsertAdMetric({
      product_id: productId,
      channel: 'meta',
      campaign_ref: row.campaignRef,
      day: row.day,
      impressions: row.impressions,
      clicks: row.clicks,
      spend_cents: row.spendCents,
      purchases: row.purchases,
      revenue_cents: row.revenueCents,
      source: 'api',
    })

    rowsWritten += 1
    spendCents += row.spendCents
    purchases += row.purchases
    revenueCents += row.revenueCents

    if (!productId) {
      unattributedSpend.set(
        row.campaignRef,
        (unattributedSpend.get(row.campaignRef) ?? 0) + row.spendCents
      )
    }
  }

  const summary: ImportSummary = {
    channel: 'meta',
    from,
    to,
    rowsFetched: rows.length,
    rowsWritten,
    attributed: attributed.filter((a) => a.productId !== null).length,
    unattributed: attributed.filter((a) => a.productId === null).length,
    unattributedCampaigns: [...unattributedSpend.entries()]
      .map(([campaignRef, cents]) => ({ campaignRef, spendCents: cents }))
      .sort((a, b) => b.spendCents - a.spendCents),
    spendCents,
    purchases,
    revenueCents,
  }

  await logEvent({
    kind: 'marketing.import',
    level: summary.unattributed > 0 ? 'warn' : 'info',
    message: `Imported ${rowsWritten} Meta row(s) for ${from}..${to}: ${summary.attributed} attributed, ${summary.unattributed} unattributed.`,
    data: { summary },
  })

  return summary
}

/** Campaigns visible in the ad account, annotated with how they attribute. */
export async function describeCampaigns(): Promise<
  (MetaCampaign & { productId: string | null; attributedBy: 'map' | 'name' | 'none' })[]
> {
  const client = new MetaAdsClient()
  const [campaigns, campaignMap, products] = await Promise.all([
    client.listCampaigns(),
    getCampaignMap(),
    listProducts({}),
  ])
  const productIdBySlug = new Map(products.map((p) => [p.slug, p.id]))

  return campaigns.map((c) => {
    if (campaignMap[c.id]) {
      return { ...c, productId: campaignMap[c.id], attributedBy: 'map' as const }
    }
    const bySlug = c.productSlug ? productIdBySlug.get(c.productSlug) : undefined
    return bySlug
      ? { ...c, productId: bySlug, attributedBy: 'name' as const }
      : { ...c, productId: null, attributedBy: 'none' as const }
  })
}
