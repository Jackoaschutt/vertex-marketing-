/**
 * Attribution capture and roll-up.
 *
 * Last non-direct click, stored in a first-party cookie on landing and attached
 * to the order at checkout. Deliberately simple and honest: this cannot see
 * view-through conversions or cross-device journeys, and the ops UI says so
 * rather than implying the numbers are complete.
 */

import type { Attribution, Order } from '../types'
import { safeDivide } from '../money'

export const ATTRIBUTION_COOKIE = 'vsp_attr'
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const CLICK_ID_PARAMS = ['fbclid', 'ttclid', 'gclid', 'msclkid'] as const

export function parseAttribution(url: URL): Attribution | null {
  const p = url.searchParams
  const source = p.get('utm_source') ?? undefined
  const clickId = CLICK_ID_PARAMS.map((k) => p.get(k)).find(Boolean) ?? undefined

  // Infer the source from a click id when UTMs are missing — ad platforms often
  // append only the click id.
  const inferred = p.get('fbclid')
    ? 'meta'
    : p.get('ttclid')
      ? 'tiktok'
      : p.get('gclid') || p.get('msclkid')
        ? 'google'
        : undefined

  const resolvedSource = source ?? inferred
  if (!resolvedSource && !clickId) return null

  return {
    source: resolvedSource,
    medium: p.get('utm_medium') ?? (clickId ? 'paid' : undefined),
    campaign: p.get('utm_campaign') ?? undefined,
    content: p.get('utm_content') ?? undefined,
    term: p.get('utm_term') ?? undefined,
    click_id: clickId,
    landing_page: url.pathname,
  }
}

export function serializeAttribution(a: Attribution): string {
  return encodeURIComponent(JSON.stringify(a))
}

export function deserializeAttribution(raw: string | undefined): Attribution {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    if (typeof parsed !== 'object' || parsed === null) return {}
    // Whitelist keys — the cookie is user-controlled input.
    const { source, medium, campaign, content, term, click_id, landing_page } =
      parsed as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 120) : undefined)
    return {
      source: str(source),
      medium: str(medium),
      campaign: str(campaign),
      content: str(content),
      term: str(term),
      click_id: str(click_id),
      landing_page: str(landing_page),
    }
  } catch {
    return {}
  }
}

export interface ChannelRollup {
  source: string
  orders: number
  revenueCents: number
  aovCents: number | null
  share: number | null
}

export function rollupByChannel(orders: Order[]): ChannelRollup[] {
  const bySource = new Map<string, { orders: number; revenueCents: number }>()
  for (const o of orders) {
    const key = o.attribution?.source || 'direct'
    const entry = bySource.get(key) ?? { orders: 0, revenueCents: 0 }
    entry.orders += 1
    entry.revenueCents += o.subtotal_cents
    bySource.set(key, entry)
  }
  const totalOrders = orders.length
  return [...bySource.entries()]
    .map(([source, v]) => ({
      source,
      orders: v.orders,
      revenueCents: v.revenueCents,
      aovCents: v.orders ? Math.round(v.revenueCents / v.orders) : null,
      share: safeDivide(v.orders, totalOrders),
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
}
