/**
 * Ad channel abstraction.
 *
 * The metric schema (ds_ad_metrics), the storage and the profit engine are all
 * live. What is missing is a client per platform, because that requires an ad
 * account and an access token this repository does not have.
 *
 * Status:
 *   manual  REAL — the operator enters spend in /ops/marketing. This is the
 *           default and it produces genuine ROAS/CPA figures.
 *   mock    MOCK — deterministic numbers for development only.
 *   meta / tiktok / google  TODO — interface below is what each must implement.
 *
 * NOTE: server.py in this repository already contains a working Meta Marketing
 * API campaign-creation path. Porting its auth and reporting calls is the
 * shortest route to a real Meta client. See docs/RUNBOOK.md.
 */

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
    status: 'TODO',
    requires: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
    note: 'Insights API client not written. server.py has a working campaign-creation path to port.',
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
  const entry = CHANNELS.find((c) => c.id === id)
  return new NotImplementedChannel(id, entry?.requires ?? [])
}
