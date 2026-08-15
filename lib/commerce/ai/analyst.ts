/**
 * AI business analyst.
 *
 * Grounding is the whole design. The metric bundle is computed from the
 * database FIRST, then handed to the model as the only permitted source of
 * fact. The model is explicitly instructed to say "the data does not show
 * this" rather than estimate. It is never asked to recall anything about the
 * business.
 *
 * Without an API key the same questions are answered by a rules engine reading
 * the same bundle — real answers from real numbers, just less fluent.
 */

import { formatMoney, formatPercent, formatRatio } from '../money'
import { listOrders, listRecommendations } from '../db/repo'
import { loadDashboard, type DashboardData } from '../analytics/profit'
import { rollupByChannel } from '../analytics/attribution'
import { generateJson } from './client'

export interface AnalystAnswer {
  answer: string
  bullets: string[]
  caveats: string[]
  generator: 'anthropic' | 'rules'
  model: string | null
}

export interface MetricBundle {
  generatedAt: string
  windows: Record<'today' | 'week' | 'month' | 'allTime', Record<string, unknown>>
  products: Record<string, unknown>[]
  channels: Record<string, unknown>[]
  openRecommendations: { title: string; kind: string; severity: string }[]
  dataQuality: string[]
}

function summarise(s: DashboardData['today']): Record<string, unknown> {
  return {
    orders: s.orders,
    units: s.units,
    grossRevenue: formatMoney(s.grossRevenueCents),
    netRevenue: formatMoney(s.netRevenueCents),
    cogs: formatMoney(s.cogsCents),
    grossProfit: formatMoney(s.grossProfitCents),
    adSpend: formatMoney(s.adSpendCents),
    paymentFees: formatMoney(s.paymentFeesCents),
    otherExpenses: formatMoney(s.otherExpensesCents),
    netProfit: formatMoney(s.netProfitCents),
    netMargin: formatPercent(s.netMargin),
    aov: s.aovCents === null ? 'insufficient data' : formatMoney(s.aovCents),
    roas: formatRatio(s.roas),
    cpa: s.cpaCents === null ? 'insufficient data' : formatMoney(s.cpaCents),
    refundRate: formatPercent(s.refundRate),
  }
}

export async function buildMetricBundle(): Promise<MetricBundle> {
  const [dashboard, orders, recommendations] = await Promise.all([
    loadDashboard(),
    listOrders({ limit: 1000 }),
    listRecommendations('open'),
  ])

  const dataQuality: string[] = []
  if (dashboard.allTime.adSpendCents === 0) {
    dataQuality.push('No ad spend has been recorded, so ROAS and CPA cannot be computed.')
  }
  if (dashboard.allTime.sessions === 0) {
    dataQuality.push('No session counts are recorded, so conversion rate is unavailable.')
  }
  if (orders.length < 30) {
    dataQuality.push(`Only ${orders.length} orders exist — per-product figures are not yet statistically meaningful.`)
  }

  return {
    generatedAt: new Date().toISOString(),
    windows: {
      today: summarise(dashboard.today),
      week: summarise(dashboard.week),
      month: summarise(dashboard.month),
      allTime: summarise(dashboard.allTime),
    },
    products: dashboard.productPnl.map((p) => ({
      name: p.product.name,
      status: p.product.status,
      published: p.product.published,
      score: p.product.product_score,
      orders: p.orders,
      units: p.units,
      revenue: formatMoney(p.revenueCents),
      cogs: formatMoney(p.cogsCents),
      grossProfit: formatMoney(p.grossProfitCents),
      adSpend: formatMoney(p.adSpendCents),
      netProfit: formatMoney(p.netProfitCents),
      roas: formatRatio(p.roas),
      cpa: p.cpaCents === null ? 'n/a' : formatMoney(p.cpaCents),
      conversionRate: formatPercent(p.conversionRate),
      refundRate: formatPercent(p.refundRate),
    })),
    channels: rollupByChannel(orders).map((c) => ({
      source: c.source,
      orders: c.orders,
      revenue: formatMoney(c.revenueCents),
      aov: c.aovCents === null ? 'n/a' : formatMoney(c.aovCents),
      shareOfOrders: formatPercent(c.share),
    })),
    openRecommendations: recommendations.map((r) => ({
      title: r.title,
      kind: r.kind,
      severity: r.severity,
    })),
    dataQuality,
  }
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'bullets', 'caveats'],
  properties: {
    answer: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    caveats: { type: 'array', items: { type: 'string' } },
  },
}

const SYSTEM = [
  'You are the analyst for a small direct-to-consumer store.',
  '',
  'The JSON metric bundle in the user message is your ONLY source of fact. It was computed from the store database immediately before this request.',
  '',
  'RULES:',
  '- Never state a number that is not in the bundle. Do not estimate, extrapolate or infer figures.',
  '- If the bundle does not contain what is needed, say exactly what is missing and what would need to be tracked.',
  '- "insufficient data", "n/a" and "—" mean the metric could not be computed. Report that; never substitute zero.',
  '- Distinguish revenue from profit in every answer where both are relevant.',
  '- Small sample sizes make per-product conclusions unreliable. Say so when the bundle flags it.',
  '- Recommend actions, but attribute each one to the specific figure that supports it.',
  '- Be direct and brief. No preamble, no restating the question.',
  '',
  'Return JSON: answer (2–4 sentences), bullets (up to 5 supporting points, each citing a figure), caveats (data limitations that affect this answer; empty array if none).',
].join('\n')

// --- Rules fallback --------------------------------------------------------

function rulesAnswer(question: string, bundle: MetricBundle): AnalystAnswer {
  const q = question.toLowerCase()
  const products = bundle.products
  const caveats = [...bundle.dataQuality, 'Answered by the built-in rules engine — set ANTHROPIC_API_KEY for a fuller analysis.']

  const byNetProfit = [...products].sort(
    (a, b) => parseMoney(String(b.netProfit)) - parseMoney(String(a.netProfit))
  )

  if (/most profitable|best product|top product/.test(q)) {
    const top = byNetProfit[0]
    if (!top) return { answer: 'There are no products with recorded sales yet.', bullets: [], caveats, generator: 'rules', model: null }
    return {
      answer: `${top.name} is the most profitable product by net profit after ad spend (${top.netProfit}).`,
      bullets: [
        `${top.name}: revenue ${top.revenue}, gross profit ${top.grossProfit}, ad spend ${top.adSpend}, net ${top.netProfit}.`,
        `ROAS ${top.roas}, CPA ${top.cpa}, refund rate ${top.refundRate}.`,
      ],
      caveats,
      generator: 'rules',
      model: null,
    }
  }

  if (/stop advertising|pause|worst|losing/.test(q)) {
    const losers = byNetProfit.filter((p) => parseMoney(String(p.netProfit)) < 0)
    if (losers.length === 0) {
      return {
        answer: 'No product is currently net-negative after ad spend, so nothing needs pausing on profitability grounds.',
        bullets: byNetProfit.slice(0, 3).map((p) => `${p.name}: net ${p.netProfit} (ROAS ${p.roas}).`),
        caveats,
        generator: 'rules',
        model: null,
      }
    }
    return {
      answer: `${losers.length} product(s) are losing money after ad spend. The worst is ${losers[losers.length - 1].name}.`,
      bullets: losers.map((p) => `${p.name}: ad spend ${p.adSpend} against ${p.revenue} revenue — net ${p.netProfit}, ROAS ${p.roas}.`),
      caveats,
      generator: 'rules',
      model: null,
    }
  }

  if (/roas/.test(q)) {
    const ranked = [...products].sort((a, b) => Number(b.roas) - Number(a.roas))
    return {
      answer: `Ranked by ROAS, ${ranked[0]?.name ?? 'no product'} leads at ${ranked[0]?.roas ?? '—'}.`,
      bullets: ranked.slice(0, 5).map((p) => `${p.name}: ROAS ${p.roas} on ${p.adSpend} spend.`),
      caveats,
      generator: 'rules',
      model: null,
    }
  }

  if (/scale|scaling|increase budget/.test(q)) {
    const candidates = products.filter((p) => Number(p.roas) >= 2 && Number(p.orders) >= 5)
    return {
      answer:
        candidates.length > 0
          ? `${candidates.length} product(s) clear a 2.0 ROAS with at least 5 orders, which is the bar for adding budget.`
          : 'No product currently clears a 2.0 ROAS with enough orders to justify scaling.',
      bullets: candidates.map((p) => `${p.name}: ROAS ${p.roas}, ${p.orders} orders, net ${p.netProfit}.`),
      caveats,
      generator: 'rules',
      model: null,
    }
  }

  if (/changed this week|this week|week/.test(q)) {
    const w = bundle.windows.week
    const m = bundle.windows.month
    return {
      answer: `In the last 7 days: ${w.orders} orders, ${w.netRevenue} net revenue and ${w.netProfit} net profit. The 30-day figures are ${m.orders} orders and ${m.netProfit} net profit.`,
      bullets: [
        `Week ROAS ${w.roas}, CPA ${w.cpa}, AOV ${w.aov}.`,
        `Week ad spend ${w.adSpend} against ${w.netRevenue} net revenue.`,
        `Refund rate ${w.refundRate}.`,
      ],
      caveats,
      generator: 'rules',
      model: null,
    }
  }

  if (/profit fall|profit drop|why.*down/.test(q)) {
    const w = bundle.windows.week
    return {
      answer: `Over the last 7 days net profit was ${w.netProfit} on ${w.netRevenue} net revenue. The deductions were ${w.cogs} COGS, ${w.adSpend} ad spend, ${w.paymentFees} payment fees and ${w.otherExpenses} other expenses.`,
      bullets: [
        `Ad spend is the largest controllable line at ${w.adSpend} (ROAS ${w.roas}).`,
        `Refund rate ${w.refundRate}.`,
        'Compare against the 30-day window to separate a trend from a single bad day.',
      ],
      caveats,
      generator: 'rules',
      model: null,
    }
  }

  if (/drop.?off|funnel|abandon/.test(q)) {
    return {
      answer:
        'Order-side drop-off can be answered from this data; page-level drop-off cannot, because no page analytics provider is connected.',
      bullets: [
        `Conversion rate: ${bundle.windows.allTime.aov === 'insufficient data' ? 'unavailable' : String(bundle.windows.allTime.roas)}`,
        'Abandoned carts are recorded at checkout start — see /ops/marketing.',
      ],
      caveats: [...caveats, 'No page-view analytics are connected, so pre-checkout drop-off is not measurable.'],
      generator: 'rules',
      model: null,
    }
  }

  const all = bundle.windows.allTime
  return {
    answer: `All-time: ${all.orders} orders, ${all.netRevenue} net revenue, ${all.netProfit} net profit (margin ${all.netMargin}).`,
    bullets: [
      `Top product by net profit: ${byNetProfit[0]?.name ?? 'none'} (${byNetProfit[0]?.netProfit ?? '—'}).`,
      `Ad spend ${all.adSpend}, ROAS ${all.roas}, CPA ${all.cpa}.`,
      `${bundle.openRecommendations.length} open recommendation(s).`,
    ],
    caveats,
    generator: 'rules',
    model: null,
  }
}

function parseMoney(s: string): number {
  const n = Number(s.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export async function ask(question: string): Promise<AnalystAnswer> {
  const bundle = await buildMetricBundle()

  const result = await generateJson<{ answer: string; bullets: string[]; caveats: string[] }>({
    system: SYSTEM,
    prompt: `QUESTION: ${question}\n\nMETRIC BUNDLE (your only source of fact):\n${JSON.stringify(bundle, null, 2)}`,
    schema: SCHEMA,
    maxTokens: 2000,
    effort: 'medium',
  })

  if (!result.data) return rulesAnswer(question, bundle)

  return {
    answer: result.data.answer,
    bullets: result.data.bullets ?? [],
    caveats: [...(result.data.caveats ?? []), ...bundle.dataQuality],
    generator: 'anthropic',
    model: result.model,
  }
}

export const SUGGESTED_QUESTIONS = [
  'What is my most profitable product?',
  'Which product should I stop advertising?',
  'Which product has the best ROAS?',
  'What changed this week?',
  'Why did profit fall?',
  'What should I test next?',
  'Which products are worth scaling?',
  'Where are customers dropping off?',
]
