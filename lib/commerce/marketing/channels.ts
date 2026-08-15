/**
 * Ad channel abstraction.
 *
 * Status:
 *   manual  REAL — the operator enters spend in /ops/marketing. Produces
 *           genuine ROAS/CPA figures and is always available.
 *   meta    REAL — Meta Marketing API client in ./adapter-meta.ts. Reads daily
 *           insights and can launch campaigns (always PAUSED). Ported from the
 *           Meta stage of server.py with its gaps closed.
 *   mock    MOCK — deterministic numbers for development only.
 *   tiktok / google  TODO — implement AdChannelClient; nothing else changes.
 */

import { MetaAdsClient } from './adapter-meta'

export interface ChannelDailyMetric {
  day: string // YYYY-MM-DD
  campaignRef: string
  productRef: string | null
  impressions: number
  clicks: number
  spendCents: number
  purchases: number
  revenueCents: number
}

export interface AdChannelClient {
  readonly id: string
  readonly status: 'REAL' | 'MOCK' | 'TODO'
  readonly requires: string[]
  /** Pull daily performance for a date range (inclusive, YYYY-MM-DD). */
  fetchDailyMetrics(from: string, to: string): Promise<ChannelDailyMetric[]>
}

export class NotImplementedChannel implements AdChannelClient {
  readonly status = 'TODO' as const
  constructor(readonly id: string, readonly requires: string[]) {}
  async fetchDailyMetrics(): Promise<ChannelDailyMetric[]> {
    throw new Error(
      `The ${this.id} ad channel client is not implemented. Required credentials: ${this.requires.join(', ')}. Enter spend manually in /ops/marketing until it is.`
    )
  }
}

export class MockChannel implements AdChannelClient {
  readonly id = 'mock'
  readonly status = 'MOCK' as const
  readonly requires: string[] = []

  async fetchDailyMetrics(from: string, to: string): Promise<ChannelDailyMetric[]> {
    const out: ChannelDailyMetric[] = []
    const start = Date.parse(from)
    const end = Date.parse(to)
    for (let t = start; t <= end; t += 86_400_000) {
      const day = new Date(t).toISOString().slice(0, 10)
      const seed = day.split('-').reduce((s, p) => s + Number(p), 0)
      out.push({
        day,
        campaignRef: 'mock-campaign',
        productRef: null,
        impressions: 20_000 + (seed % 9_000),
        clicks: 300 + (seed % 200),
        spendCents: 4_000 + (seed % 2_500),
        purchases: 3 + (seed % 4),
        revenueCents: (3 + (seed % 4)) * 4_900,
      })
    }
    return out
  }
}

export const CHANNELS: { id: string; label: string; status: 'REAL' | 'MOCK' | 'TODO'; requires: string[]; note: string }[] = [
  {
    id: 'manual',
    label: 'Manual entry',
    status: 'REAL',
    requires: [],
    note: 'Enter daily spend per product in /ops/marketing. Produces real ROAS, CPA and profit figures.',
  },
  {
    id: 'meta',
    label: 'Meta Ads',
    status: 'REAL',
    requires: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID (to launch campaigns)'],
    note: 'Daily insights import and campaign creation. Verify with the status check before importing — it proves the token, account id, API version and permissions in one round trip.',
  },
  {
    id: 'tiktok',
    label: 'TikTok Ads',
    status: 'TODO',
    requires: ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'],
    note: 'Reporting API client not written.',
  },
  {
    id: 'google',
    label: 'Google Ads',
    status: 'TODO',
    requires: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_REFRESH_TOKEN'],
    note: 'Google Ads API client not written.',
  },
]

export function channelFor(id: string): AdChannelClient {
  if (id === 'mock') return new MockChannel()
  if (id === 'meta') return new MetaAdsClient()
  const entry = CHANNELS.find((c) => c.id === id)
  return new NotImplementedChannel(id, entry?.requires ?? [])
}
