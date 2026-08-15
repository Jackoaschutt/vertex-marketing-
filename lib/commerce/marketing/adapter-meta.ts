/**
 * META ADS CLIENT — STATUS: REAL.
 *
 * Ported from the Meta section of `server.py` (stage 4), with the gaps in that
 * implementation closed. What changed and why:
 *
 *   server.py                              here
 *   ─────────────────────────────────────  ──────────────────────────────────
 *   page_id: "YOUR_PAGE_ID" placeholder    META_PAGE_ID, required, checked
 *   interests sent by NAME                 resolved to real IDs via /search
 *   `.json().get("id")` — silent failure   every response checked, Meta's own
 *                                          error message surfaced verbatim
 *   API version hard-coded v19.0           META_API_VERSION, version errors
 *                                          detected and explained
 *   creates campaigns only                 also READS performance, which is
 *                                          what the profit engine needs
 *   no attribution back to a product       campaign → product mapping, so
 *                                          spend lands on the right P&L row
 *
 * ⚠️ VERIFICATION STATUS: this issues real Graph API requests written to
 * Meta's documented Marketing API shapes, but it has NOT been executed against
 * a live ad account from this repository — no token was available. Run
 * `GET /api/commerce/marketing/meta/status` first: it performs a real
 * round-trip and reports the account name, currency and timezone, so you know
 * the credentials and API version work before importing anything or spending
 * money.
 *
 * MONEY: Meta returns `spend` and `action_values` as decimal strings in the ad
 * account's currency. They are converted to integer minor units on the way in,
 * like every other amount in this system. If the ad account's currency differs
 * from COMMERCE_CURRENCY the figures are NOT converted — verifyAccess()
 * reports the account currency so the mismatch is visible rather than silently
 * corrupting ROAS.
 */

import { toCents } from '../money'
import type { AdChannelClient, ChannelDailyMetric } from './channels'

/**
 * Graph API host. Overridable so the client can be integration-tested against a
 * local mock (see tests/meta-integration.test.ts) or pointed at an egress proxy.
 * Leave it unset in production.
 */
const GRAPH = process.env.META_GRAPH_BASE ?? 'https://graph.facebook.com'

/**
 * Graph API version. Meta supports each version for roughly two years and
 * returns an explicit error once one expires, so this is configurable and the
 * expiry error is detected and explained rather than surfaced raw.
 * Check https://developers.facebook.com/docs/graph-api/changelog before relying
 * on the default.
 */
export const META_API_VERSION = process.env.META_API_VERSION ?? 'v23.0'

export class MetaNotConfiguredError extends Error {
  constructor(readonly requires: string[]) {
    super(`Meta Ads is not configured. Set: ${requires.join(', ')}.`)
    this.name = 'MetaNotConfiguredError'
  }
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
    readonly hint?: string
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

export interface MetaCredentials {
  accessToken: string
  adAccountId: string // act_1234567890
  pageId?: string
}

export function metaCredentials(requirePage = false): MetaCredentials {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID
  const pageId = process.env.META_PAGE_ID

  const missing: string[] = []
  if (!accessToken) missing.push('META_ACCESS_TOKEN')
  if (!adAccountId) missing.push('META_AD_ACCOUNT_ID')
  if (requirePage && !pageId) missing.push('META_PAGE_ID')
  if (missing.length > 0) throw new MetaNotConfiguredError(missing)

  return {
    accessToken: accessToken!,
    // Meta requires the act_ prefix; accept it with or without.
    adAccountId: adAccountId!.startsWith('act_') ? adAccountId! : `act_${adAccountId}`,
    pageId,
  }
}

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID)
}

// --- Pure transforms (unit-tested without a network) -----------------------

/**
 * Raw insights row as returned by the Graph API. Only the fields we request
 * are typed; Meta may include others.
 */
export interface MetaInsightsRow {
  date_start?: string
  date_stop?: string
  campaign_id?: string
  campaign_name?: string
  impressions?: string
  clicks?: string
  spend?: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

/**
 * Purchase action types Meta may return, most-preferred first.
 *
 * `omni_purchase` is Meta's deduplicated cross-surface total. When it is
 * present it is the only one we read — summing the others alongside it would
 * count the same purchase two or three times and silently inflate ROAS.
 */
export const PURCHASE_ACTION_TYPES = [
  'omni_purchase',
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
] as const

export function extractAction(
  rows: { action_type: string; value: string }[] | undefined
): number {
  if (!rows || rows.length === 0) return 0
  for (const type of PURCHASE_ACTION_TYPES) {
    const match = rows.find((r) => r.action_type === type)
    if (match) {
      const n = Number(match.value)
      return Number.isFinite(n) ? n : 0
    }
  }
  return 0
}

export function extractActionValueCents(
  rows: { action_type: string; value: string }[] | undefined
): number {
  if (!rows || rows.length === 0) return 0
  for (const type of PURCHASE_ACTION_TYPES) {
    const match = rows.find((r) => r.action_type === type)
    if (match) return toCents(match.value)
  }
  return 0
}

/**
 * Campaign-name product marker.
 *
 * Meta knows nothing about our product ids, so a campaign created outside this
 * app can still be attributed by putting `[vsp:<product-slug>]` anywhere in its
 * name. Campaigns launched from /ops get an explicit id mapping instead, which
 * takes precedence.
 */
const SLUG_MARKER = /\[vsp:([a-z0-9-]{1,80})\]/i

export function productSlugFromCampaignName(name: string | undefined): string | null {
  if (!name) return null
  const match = SLUG_MARKER.exec(name)
  return match ? match[1].toLowerCase() : null
}

export function campaignNameFor(productName: string, slug: string, date = new Date()): string {
  const month = date.toLocaleString('en-US', { month: 'short', year: 'numeric' })
  return `${productName} — ${month} [vsp:${slug}]`
}

export function toDailyMetric(row: MetaInsightsRow): ChannelDailyMetric {
  return {
    day: row.date_start ?? '',
    campaignRef: row.campaign_id ?? 'meta-unknown',
    productRef: productSlugFromCampaignName(row.campaign_name),
    impressions: Number(row.impressions ?? 0) || 0,
    clicks: Number(row.clicks ?? 0) || 0,
    spendCents: toCents(row.spend ?? '0'),
    purchases: extractAction(row.actions),
    revenueCents: extractActionValueCents(row.action_values),
  }
}

/**
 * Meta caps an insights query at 90 days. Longer ranges are split so a caller
 * asking for a year does not get a truncated answer with no warning.
 */
export function splitRange(from: string, to: string, maxDays = 90): { since: string; until: string }[] {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error(`Invalid date range: ${from} to ${to}.`)
  }
  const chunks: { since: string; until: string }[] = []
  const step = maxDays * 86_400_000
  for (let cursor = start; cursor <= end; cursor += step) {
    const chunkEnd = Math.min(cursor + step - 86_400_000, end)
    chunks.push({
      since: new Date(cursor).toISOString().slice(0, 10),
      until: new Date(chunkEnd).toISOString().slice(0, 10),
    })
  }
  return chunks
}

/** Turns Meta's error envelope into something an operator can act on. */
export function explainMetaError(status: number, body: unknown): MetaApiError {
  const err = (body as { error?: Record<string, unknown> } | null)?.error ?? {}
  const message = String(err.message ?? `Graph API returned ${status}.`)
  const code = typeof err.code === 'number' ? err.code : undefined
  const subcode = typeof err.error_subcode === 'number' ? err.error_subcode : undefined

  let hint: string | undefined
  if (/unsupported (get|post) request|does not exist/i.test(message) && status === 400) {
    hint = `Check META_AD_ACCOUNT_ID (it must include the act_ prefix) and META_API_VERSION (currently ${META_API_VERSION}). An expired API version produces this error.`
  } else if (code === 190) {
    hint = 'The access token is invalid or expired. Generate a new long-lived System User token in Meta Business Settings.'
  } else if (code === 200 || status === 403) {
    hint = 'The token lacks a required permission. Ads reporting needs ads_read; creating campaigns needs ads_management.'
  } else if (code === 17 || code === 613 || status === 429) {
    hint = 'Meta is rate limiting this ad account. Wait and retry — import a shorter date range if this keeps happening.'
  } else if (code === 100 && /reduce the amount of data/i.test(message)) {
    hint = 'The requested range is too large. Import a shorter window.'
  }

  return new MetaApiError(message, status, code, subcode, hint)
}

// --- Client ----------------------------------------------------------------

export interface MetaAccount {
  id: string
  name: string
  currency: string
  timezone: string
  /** Meta's account_status: 1 = active. Anything else cannot spend. */
  accountStatus: number
  statusLabel: string
}

export interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  dailyBudgetCents: number | null
  productSlug: string | null
}

export interface CreateCampaignInput {
  productName: string
  productSlug: string
  destinationUrl: string
  dailyBudgetCents: number
  headline: string
  body: string
  interests?: string[]
  countries?: string[]
  ageMin?: number
  ageMax?: number
}

export interface CreateCampaignResult {
  campaignId: string
  adSetId: string
  creativeId: string
  adId: string
  campaignName: string
  status: 'PAUSED'
  resolvedInterests: { name: string; id: string }[]
  unresolvedInterests: string[]
  adsManagerUrl: string
}

const ACCOUNT_STATUS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_RISK_REVIEW',
  8: 'PENDING_SETTLEMENT',
  9: 'IN_GRACE_PERIOD',
  100: 'PENDING_CLOSURE',
  101: 'CLOSED',
  201: 'ANY_ACTIVE',
  202: 'ANY_CLOSED',
}

export class MetaAdsClient implements AdChannelClient {
  readonly id = 'meta'
  readonly status = 'REAL' as const
  readonly requires = ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID (campaign creation only)']

  private async request<T>(
    path: string,
    opts: { method?: 'GET' | 'POST'; query?: Record<string, string>; body?: Record<string, unknown> } = {}
  ): Promise<T> {
    const { accessToken } = metaCredentials()
    const url = new URL(`${GRAPH}/${META_API_VERSION}${path}`)
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)

    const method = opts.method ?? 'GET'
    // The token goes in the Authorization header, never the query string —
    // query strings end up in proxy and server logs.
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
    }
    if (opts.body) init.body = JSON.stringify(opts.body)

    let res: Response
    try {
      res = await fetch(url, init)
    } catch (err) {
      throw new MetaApiError(`Network error calling Meta Graph API: ${String(err)}`, 0)
    }

    const text = await res.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      throw new MetaApiError(`Meta returned non-JSON (${res.status}): ${text.slice(0, 300)}`, res.status)
    }
    if (!res.ok) throw explainMetaError(res.status, parsed)
    return parsed as T
  }

  /**
   * Follows an absolute paging link returned by the Graph API.
   *
   * The origin is checked against GRAPH before the request is made. Meta's
   * paging URLs are same-origin by definition, so a link pointing anywhere else
   * means something is wrong — and blindly following a URL out of a response
   * body, with our bearer token attached, is how a token gets sent to a host
   * that should never see it.
   */
  private async requestUrl<T>(absoluteUrl: string): Promise<T> {
    const { accessToken } = metaCredentials()

    let target: URL
    try {
      target = new URL(absoluteUrl)
    } catch {
      throw new MetaApiError(`Meta returned an unparseable paging URL: ${absoluteUrl}`, 0)
    }
    if (target.origin !== new URL(GRAPH).origin) {
      throw new MetaApiError(
        `Refusing to follow a Meta paging link to a different origin (${target.origin}). Expected ${new URL(GRAPH).origin}.`,
        0
      )
    }

    const res = await fetch(target, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }).catch((err) => {
      throw new MetaApiError(`Network error following Meta paging link: ${String(err)}`, 0)
    })
    const text = await res.text()
    const parsed = text ? JSON.parse(text) : null
    if (!res.ok) throw explainMetaError(res.status, parsed)
    return parsed as T
  }

  /**
   * Real round-trip against the ad account. Run this before importing or
   * spending — it is the cheapest way to prove the token, account id, API
   * version and permissions all work.
   */
  async verifyAccess(): Promise<MetaAccount> {
    const { adAccountId } = metaCredentials()
    const data = await this.request<{
      id: string
      name?: string
      currency?: string
      timezone_name?: string
      account_status?: number
    }>(`/${adAccountId}`, {
      query: { fields: 'id,name,currency,timezone_name,account_status' },
    })
    const status = data.account_status ?? 0
    return {
      id: data.id,
      name: data.name ?? adAccountId,
      currency: data.currency ?? 'UNKNOWN',
      timezone: data.timezone_name ?? 'UNKNOWN',
      accountStatus: status,
      statusLabel: ACCOUNT_STATUS[status] ?? `UNKNOWN (${status})`,
    }
  }

  /**
   * Daily performance per campaign.
   *
   * `time_increment=1` gives one row per campaign per day, which maps directly
   * onto ds_ad_metrics' (product, channel, campaign, day) unique key.
   */
  async fetchDailyMetrics(from: string, to: string): Promise<ChannelDailyMetric[]> {
    const { adAccountId } = metaCredentials()
    const out: ChannelDailyMetric[] = []

    for (const range of splitRange(from, to)) {
      let next: string | null = null
      let page = 0

      do {
        const data: { data?: MetaInsightsRow[]; paging?: { next?: string } } = next
          ? await this.requestUrl(next)
          : await this.request(`/${adAccountId}/insights`, {
              query: {
                level: 'campaign',
                time_increment: '1',
                time_range: JSON.stringify({ since: range.since, until: range.until }),
                fields:
                  'date_start,date_stop,campaign_id,campaign_name,impressions,clicks,spend,actions,action_values',
                limit: '500',
              },
            })

        for (const row of data.data ?? []) out.push(toDailyMetric(row))
        next = data.paging?.next ?? null
        page += 1
        // Defensive: a paging loop against a remote API should never be
        // unbounded. 200 pages × 500 rows is far beyond any real account.
        if (page > 200) {
          throw new MetaApiError('Aborting: Meta insights paging exceeded 200 pages.', 0)
        }
      } while (next)
    }

    return out
  }

  async listCampaigns(limit = 100): Promise<MetaCampaign[]> {
    const { adAccountId } = metaCredentials()
    const data = await this.request<{
      data?: {
        id: string
        name: string
        status: string
        objective: string
        daily_budget?: string
      }[]
    }>(`/${adAccountId}/campaigns`, {
      query: { fields: 'id,name,status,objective,daily_budget', limit: String(limit) },
    })
    return (data.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      // daily_budget is already in the account currency's minor units.
      dailyBudgetCents: c.daily_budget ? Number(c.daily_budget) : null,
      productSlug: productSlugFromCampaignName(c.name),
    }))
  }

  /**
   * Resolves interest names to Meta targeting IDs.
   *
   * server.py passed interest *names* straight into `flexible_spec`, which Meta
   * ignores — the campaign silently ran fully broad instead of targeted. Names
   * must be resolved to IDs through the targeting search endpoint first.
   */
  async searchInterests(names: string[]): Promise<{
    resolved: { name: string; id: string }[]
    unresolved: string[]
  }> {
    const resolved: { name: string; id: string }[] = []
    const unresolved: string[] = []

    for (const name of names) {
      const data = await this.request<{ data?: { id: string; name: string; audience_size_lower_bound?: number }[] }>(
        '/search',
        { query: { type: 'adinterest', q: name, limit: '1' } }
      )
      const hit = data.data?.[0]
      if (hit) resolved.push({ name: hit.name, id: hit.id })
      else unresolved.push(name)
    }

    return { resolved, unresolved }
  }

  /**
   * Creates campaign → ad set → creative → ad, always PAUSED.
   *
   * PAUSED is not a placeholder: an automated system must never start spending
   * money without a human looking at the creative first.
   */
  async createCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
    const { adAccountId, pageId } = metaCredentials(true)
    const campaignName = campaignNameFor(input.productName, input.productSlug)

    if (input.dailyBudgetCents < 100) {
      throw new MetaApiError('Daily budget must be at least 1.00 in the account currency.', 400)
    }

    // 1. Campaign
    const campaign = await this.request<{ id: string }>(`/${adAccountId}/campaigns`, {
      method: 'POST',
      body: {
        name: campaignName,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        special_ad_categories: [],
      },
    })

    // 2. Interests → real IDs
    const { resolved, unresolved } = input.interests?.length
      ? await this.searchInterests(input.interests)
      : { resolved: [], unresolved: [] }

    const targeting: Record<string, unknown> = {
      geo_locations: { countries: input.countries?.length ? input.countries : ['US'] },
      age_min: input.ageMin ?? 18,
      age_max: input.ageMax ?? 55,
    }
    if (resolved.length > 0) {
      targeting.flexible_spec = [{ interests: resolved.map((i) => ({ id: i.id, name: i.name })) }]
    }

    // 3. Ad set
    const adSet = await this.request<{ id: string }>(`/${adAccountId}/adsets`, {
      method: 'POST',
      body: {
        name: `${input.productName} — ${resolved.length ? 'Interests' : 'Broad'}`,
        campaign_id: campaign.id,
        daily_budget: input.dailyBudgetCents,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        targeting,
        status: 'PAUSED',
      },
    })

    // 4. Creative
    const creative = await this.request<{ id: string }>(`/${adAccountId}/adcreatives`, {
      method: 'POST',
      body: {
        name: `${input.productName} creative`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            link: input.destinationUrl,
            message: input.body,
            name: input.headline,
            call_to_action: { type: 'SHOP_NOW', value: { link: input.destinationUrl } },
          },
        },
      },
    })

    // 5. Ad
    const ad = await this.request<{ id: string }>(`/${adAccountId}/ads`, {
      method: 'POST',
      body: {
        name: `${input.productName} ad`,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status: 'PAUSED',
      },
    })

    return {
      campaignId: campaign.id,
      adSetId: adSet.id,
      creativeId: creative.id,
      adId: ad.id,
      campaignName,
      status: 'PAUSED',
      resolvedInterests: resolved,
      unresolvedInterests: unresolved,
      adsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${adAccountId.replace('act_', '')}`,
    }
  }
}
