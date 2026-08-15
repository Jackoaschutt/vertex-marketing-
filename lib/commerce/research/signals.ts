/**
 * Research signal collection.
 *
 * The one hard rule: this module never invents a signal. If SERPAPI_KEY is
 * absent, or the request fails, or the provider returns nothing useful, the
 * result says so. A fabricated trend line would be worse than no data, because
 * it would feed the demand score and make a bad candidate look validated.
 *
 * Ported from the SerpAPI stage of server.py, with the gaps closed:
 *   - server.py fell back to a hardcoded "preview" payload when the key was
 *     missing, which is indistinguishable from a real result once stored.
 *     Here a missing key is an explicit unavailable status.
 *   - Trend direction was eyeballed from the last two points. Here it is
 *     computed from the mean of the first and last thirds of the series, so a
 *     single spike does not read as a trend.
 */

import type { ResearchSignal, TrendDirection } from '../types'

const SERPAPI = process.env.SERPAPI_BASE ?? 'https://serpapi.com/search.json'

export function isSerpApiConfigured(): boolean {
  const key = process.env.SERPAPI_KEY
  return typeof key === 'string' && key.trim().length > 0
}

export class SignalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly hint?: string
  ) {
    super(message)
    this.name = 'SignalError'
  }
}

export interface CollectedSignal {
  keyword: string
  source: ResearchSignal['source']
  payload: Record<string, unknown>
  trendDirection: TrendDirection
  trendScore: number | null
  competitionCount: number | null
  /** Plain-language reading of what was found, shown next to the score. */
  reading: string
}

interface TimelinePoint {
  value: number
}

/**
 * Direction from the mean of the first third versus the last third.
 * A 15% swing is the threshold — below that, "flat" is the honest answer.
 */
export function trendFrom(points: number[]): { direction: TrendDirection; score: number | null } {
  if (points.length < 6) return { direction: 'unknown', score: null }

  const third = Math.floor(points.length / 3)
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const start = mean(points.slice(0, third))
  const end = mean(points.slice(-third))

  // A series that is entirely zero carries no information either way.
  if (start === 0 && end === 0) return { direction: 'unknown', score: null }

  const peak = Math.max(...points)
  const score = peak > 0 ? Math.round((end / peak) * 100) : null

  if (start === 0) return { direction: 'rising', score }
  const change = (end - start) / start
  if (change > 0.15) return { direction: 'rising', score }
  if (change < -0.15) return { direction: 'falling', score }
  return { direction: 'flat', score }
}

function readingFor(direction: TrendDirection, score: number | null): string {
  switch (direction) {
    case 'rising':
      return `Interest is trending up${score !== null ? `, currently at ${score}% of its 12-month peak` : ''}. Rising demand is the best case, but check whether it is seasonal before reading it as growth.`
    case 'falling':
      return `Interest is trending down${score !== null ? `, currently at ${score}% of its 12-month peak` : ''}. Entering a falling market means competing for a shrinking pool.`
    case 'flat':
      return `Interest is stable${score !== null ? ` at around ${score}% of its 12-month peak` : ''}. Steady demand is workable — it just will not carry a weak angle.`
    default:
      return 'Not enough data points to read a direction. Treat demand as unproven.'
  }
}

async function serpApi(params: Record<string, string>): Promise<Record<string, unknown>> {
  const key = process.env.SERPAPI_KEY
  if (!key) {
    throw new SignalError(
      'SERPAPI_KEY is not set, so no demand data can be collected.',
      0,
      'Set SERPAPI_KEY, or score demand by hand and record where the number came from.'
    )
  }

  const url = new URL(SERPAPI)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('api_key', key)

  let res: Response
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new SignalError(`Could not reach SerpAPI: ${String(err)}`, 0)
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok) {
    const message = typeof body.error === 'string' ? body.error : `SerpAPI returned ${res.status}.`
    throw new SignalError(
      message,
      res.status,
      res.status === 401
        ? 'The key was rejected. Check SERPAPI_KEY.'
        : res.status === 429
          ? 'Monthly search quota is exhausted.'
          : undefined
    )
  }
  if (typeof body.error === 'string') throw new SignalError(body.error, 200)

  return body
}

/** Google Trends interest over time for a keyword. */
export async function collectTrend(keyword: string): Promise<CollectedSignal> {
  const body = await serpApi({
    engine: 'google_trends',
    q: keyword,
    data_type: 'TIMESERIES',
    date: 'today 12-m',
  })

  const timeline =
    ((body.interest_over_time as Record<string, unknown> | undefined)?.timeline_data as
      | Record<string, unknown>[]
      | undefined) ?? []

  const points = timeline
    .map((row) => {
      const values = row.values as TimelinePoint[] | undefined
      return values && values.length > 0 ? Number(values[0].value ?? 0) : 0
    })
    .filter((n) => Number.isFinite(n))

  const { direction, score } = trendFrom(points)

  return {
    keyword,
    source: 'serpapi_trends',
    payload: { pointCount: points.length, points, raw: body.search_metadata ?? {} },
    trendDirection: direction,
    trendScore: score,
    competitionCount: null,
    reading: readingFor(direction, score),
  }
}

/** How many sellers already list this, as a competition proxy. */
export async function collectCompetition(keyword: string): Promise<CollectedSignal> {
  const body = await serpApi({ engine: 'google_shopping', q: keyword })
  const results = (body.shopping_results as unknown[] | undefined) ?? []
  const count = results.length

  const reading =
    count === 0
      ? 'No shopping results at all. That usually means no market rather than an untapped one — verify demand exists before reading this as an opportunity.'
      : count < 10
        ? `${count} sellers listed. Thin competition, which is promising if demand is real.`
        : count < 40
          ? `${count} sellers listed. Normal competition — you will need a distinct angle rather than a lower price.`
          : `${count}+ sellers listed. Crowded. Winning here usually means better creative or a sharper audience, not a better product.`

  return {
    keyword,
    source: 'serpapi_shopping',
    payload: { count, sample: results.slice(0, 5) },
    trendDirection: 'unknown',
    trendScore: null,
    competitionCount: count,
    reading,
  }
}
