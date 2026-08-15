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
import { listPostmortems, listRecommendations, listSales } from '../db/repo'
import { loadDashboard, type ProfitSummary } from '../analytics/profit'
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
  /** Past outcomes in the owner's own words — what the coach should reason from. */
  history: Record<string, unknown>[]
  openRecommendations: { title: string; kind: string; severity: string }[]
  dataQuality: string[]
}

function summarise(s: ProfitSummary): Record<string, unknown> {
  return {
    units: s.units,
    revenue: formatMoney(s.revenueCents),
    refunds: formatMoney(s.refundsCents),
    cogs: formatMoney(s.cogsCents),
    grossProfit: formatMoney(s.grossProfitCents),
    fees: formatMoney(s.feesCents),
    adSpend: formatMoney(s.adSpendCents),
    otherExpenses: formatMoney(s.expensesCents),
    netProfit: formatMoney(s.netProfitCents),
    grossMargin: formatPercent(s.grossMargin),
    netMargin: formatPercent(s.netMargin),
    roas: formatRatio(s.roas),
    cpa: s.cpaCents === null ? 'insufficient data' : formatMoney(s.cpaCents),
    revenuePerUnit:
      s.revenuePerUnitCents === null ? 'insufficient data' : formatMoney(s.revenuePerUnitCents),
    refundRate: formatPercent(s.refundRate),
  }
}

export async function buildMetricBundle(): Promise<MetricBundle> {
  const [dashboard, sales, postmortems, recommendations] = await Promise.all([
    loadDashboard(),
    listSales(),
    listPostmortems(),
    listRecommendations('open'),
  ])

  // Stating the limits of the data is part of the answer. A confident number
  // computed from four days of hand-entered rows is worse than no number.
  const dataQuality: string[] = []
  if (dashboard.allTime.adSpendCents === 0) {
    dataQuality.push('No ad spend has been recorded, so ROAS and CPA cannot be computed.')
  }
  if (sales.length === 0) {
    dataQuality.push('The sales ledger is empty, so every revenue and profit figure is zero because nothing has been entered — not because nothing sold.')
  } else if (sales.length < 14) {
    dataQuality.push(`Only ${sales.length} ledger entr(ies) exist. Per-product figures are indicative, not conclusive.`)
  }
  if (dashboard.unattributedAdSpendCents > 0) {
    dataQuality.push(
      `${formatMoney(dashboard.unattributedAdSpendCents)} of ad spend is not attached to a product, so per-product ROAS is understated while the whole-business figure is correct.`
    )
  }
  if (postmortems.length === 0) {
    dataQuality.push('No post-mortems have been written, so there is no recorded history to reason about causes from.')
  }

  // Sales grouped by the channel they were entered against.
  const byChannel = new Map<string, { units: number; revenueCents: number }>()
  for (const s of sales) {
    const c = byChannel.get(s.channel) ?? { units: 0, revenueCents: 0 }
    c.units += s.units
    c.revenueCents += s.revenue_cents - s.refunds_cents
    byChannel.set(s.channel, c)
  }
  const totalRevenue = [...byChannel.values()].reduce((sum, c) => sum + c.revenueCents, 0)

  return {
    generatedAt: new Date().toISOString(),
    windows: {
      today: summarise(dashboard.today),
      week: summarise(dashboard.week),
      month: summarise(dashboard.month),
      allTime: summarise(dashboard.allTime),
    },
    products: dashboard.productPnl.map(({ product, summary }) => ({
      name: product.name,
      status: product.status,
      score: product.product_score,
      units: summary.units,
      revenue: formatMoney(summary.revenueCents),
      cogs: formatMoney(summary.cogsCents),
      grossProfit: formatMoney(summary.grossProfitCents),
      adSpend: formatMoney(summary.adSpendCents),
      netProfit: formatMoney(summary.netProfitCents),
      grossMargin: formatPercent(summary.grossMargin),
      roas: formatRatio(summary.roas),
      cpa: summary.cpaCents === null ? 'n/a' : formatMoney(summary.cpaCents),
      refundRate: formatPercent(summary.refundRate),
    })),
    channels: [...byChannel.entries()].map(([source, c]) => ({
      source,
      units: c.units,
      revenue: formatMoney(c.revenueCents),
      shareOfRevenue: formatPercent(totalRevenue > 0 ? c.revenueCents / totalRevenue : null),
    })),
    history: postmortems.map((p) => ({
      productId: p.product_id,
      outcome: p.outcome,
      factors: p.factors,
      whatWorked: p.what_worked,
      whatFailed: p.what_failed,
      nextTime: p.next_time,
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
  'You are the analyst and coach for one person learning ecommerce. They research products here, sell elsewhere, and keep their books here.',
  '',
  'The JSON metric bundle in the user message is your ONLY source of fact. It was computed from their database immediately before this request, from a hand-entered ledger.',
  '',
  'RULES:',
  '- Never state a number that is not in the bundle. Do not estimate, extrapolate or infer figures.',
  '- If the bundle does not contain what is needed, say exactly what is missing and what would need to be tracked.',
  '- "insufficient data", "n/a" and "—" mean the metric could not be computed. Report that; never substitute zero.',
  '- Distinguish revenue from profit in every answer where both are relevant.',
  '- Small sample sizes make per-product conclusions unreliable. Say so when the bundle flags it.',
  '- Recommend actions, but attribute each one to the specific figure that supports it.',
  '- Be direct and brief. No preamble, no restating the question.',
  '- The `history` array holds their own post-mortems. Reason from those when asked about causes or patterns; quote their words rather than inventing an explanation.',
  '- They are learning. When a figure implies a general lesson, say the lesson once, plainly, without lecturing.',
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
    const candidates = products.filter((p) => Number(p.roas) >= 2 && Number(p.units) >= 5)
    return {
      answer:
        candidates.length > 0
          ? `${candidates.length} product(s) clear a 2.0 ROAS with at least 5 orders, which is the bar for adding budget.`
          : 'No product currently clears a 2.0 ROAS with enough orders to justify scaling.',
      bullets: candidates.map((p) => `${p.name}: ROAS ${p.roas}, ${p.units} unit(s), net ${p.netProfit}.`),
      caveats,
      generator: 'rules',
      model: null,
    }
  }

  if (/changed this week|this week|week/.test(q)) {
    const w = bundle.windows.week
    const m = bundle.windows.month
    return {
      answer: `In the last 7 days: ${w.units} unit(s), ${w.revenue} revenue and ${w.netProfit} net profit. The 30-day figures are ${m.units} unit(s) and ${m.netProfit} net profit.`,
      bullets: [
        `Week ROAS ${w.roas}, CPA ${w.cpa}, revenue per unit ${w.revenuePerUnit}.`,
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
        `All-time ROAS: ${String(bundle.windows.allTime.roas)}`,
        'Abandoned carts are recorded at checkout start — see /ops/marketing.',
      ],
      caveats: [...caveats, 'No page-view analytics are connected, so pre-checkout drop-off is not measurable.'],
      generator: 'rules',
      model: null,
    }
  }

  const all = bundle.windows.allTime
  return {
    answer: `All-time: ${all.units} unit(s), ${all.revenue} revenue, ${all.netProfit} net profit (margin ${all.netMargin}).`,
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
