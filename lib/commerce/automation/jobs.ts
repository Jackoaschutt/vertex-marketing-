/**
 * Automation engine.
 *
 * Pure job functions with no scheduler coupling — invoked from
 * POST /api/commerce/automations/run (admin session or CRON_SECRET), so any
 * scheduler works.
 *
 * Nothing here edits a product. Jobs produce recommendations and the owner
 * decides. That matters more in a research tool than it did in a shop: the
 * whole point is to build the operator's judgement, not to replace it.
 */

import { formatMoney, formatRatio, safeDivide } from '../money'
import { computeProductPnl, daysAgoIso, todayIso, unattributedAdSpend } from '../analytics/profit'
import {
  clearOpenRecommendations,
  createRecommendation,
  getSetting,
  listAdMetrics,
  listAllChecklistProgress,
  listPostmortems,
  listProducts,
  listRecommendations,
  listSales,
  logEvent,
} from '../db/repo'
import { isMetaConfigured, MetaApiError } from '../marketing/adapter-meta'
import { importMetaMetrics } from '../marketing/import'
import { CHECKLISTS, stageForStatus } from '../research/checklist'
import type { Recommendation } from '../types'

export interface JobReport {
  job: string
  checked: number
  findings: string[]
  errors: string[]
}

export interface AutomationRun {
  ran: 'daily' | 'weekly' | 'all'
  startedAt: string
  finishedAt: string
  reports: JobReport[]
  recommendationsCreated: number
}

async function recommend(
  r: Pick<Recommendation, 'kind' | 'severity' | 'title' | 'body'> & {
    product_id?: string | null
    evidence?: Record<string, unknown>
  }
): Promise<void> {
  await createRecommendation({
    kind: r.kind,
    severity: r.severity,
    title: r.title,
    body: r.body,
    product_id: r.product_id ?? null,
    evidence: r.evidence ?? {},
    status: 'open',
  })
}

// --- DAILY -----------------------------------------------------------------

/**
 * Bookkeeping hygiene.
 *
 * A hand-kept ledger fails quietly: you stop entering for a few days and every
 * figure downstream is wrong without anything looking broken. This job is the
 * thing that notices.
 */
export async function jobLedgerGaps(): Promise<JobReport> {
  const report: JobReport = { job: 'ledger-gaps', checked: 0, findings: [], errors: [] }
  const since = daysAgoIso(13)
  const [sales, adMetrics] = await Promise.all([listSales(since), listAdMetrics(since)])

  const salesDays = new Set(sales.map((s) => s.day))
  const adDays = new Set(adMetrics.map((m) => m.day))

  // Yesterday backwards — today is legitimately incomplete.
  const missing: string[] = []
  for (let i = 1; i <= 13; i += 1) {
    const day = daysAgoIso(i)
    if (adDays.has(day) && !salesDays.has(day)) missing.push(day)
  }
  report.checked = 13

  if (missing.length > 0) {
    report.findings.push(
      `${missing.length} day(s) have ad spend recorded but no sales entry: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`
    )
    await recommend({
      kind: 'investigate',
      severity: missing.length >= 3 ? 'critical' : 'warning',
      title: `${missing.length} day(s) of spend with no sales entered`,
      body: `Those days count advertising cost against zero revenue, so profit, ROAS and every per-product figure are understated until the ledger is filled in.\n\nMissing: ${missing.join(', ')}\n\nIf a day genuinely had no sales, enter it as zero — that is a fact, and it stops this appearing again.`,
      evidence: { missing },
    })
  } else if (salesDays.size === 0 && adDays.size === 0) {
    report.findings.push('No ledger activity in the last 14 days.')
  } else {
    report.findings.push('Ledger has no gaps against recorded ad spend.')
  }

  const orphanSpend = unattributedAdSpend(adMetrics)
  if (orphanSpend > 0) {
    report.findings.push(
      `${formatMoney(orphanSpend)} of ad spend is not attached to a product, so it lands in the whole-business total but no product P&L.`
    )
  }

  return report
}

/** Daily advertising check against the target ROAS. */
export async function jobAdPerformance(): Promise<JobReport> {
  const report: JobReport = { job: 'ad-performance', checked: 0, findings: [], errors: [] }
  const targetRoas = await getSetting<number>('target_roas', 2)
  const since = daysAgoIso(7)
  const [products, sales, adMetrics] = await Promise.all([
    listProducts({}),
    listSales(since),
    listAdMetrics(since),
  ])

  if (adMetrics.length === 0) {
    report.findings.push('No ad spend recorded in the last 7 days — advertising checks were skipped.')
    return report
  }

  for (const { product, summary } of computeProductPnl(products, sales, adMetrics)) {
    if (summary.adSpendCents === 0) continue
    report.checked += 1

    if (summary.roas !== null && summary.roas < targetRoas * 0.6) {
      report.findings.push(`${product.name}: ROAS ${formatRatio(summary.roas)} is well below target.`)
      await recommend({
        kind: 'pause',
        severity: 'critical',
        product_id: product.id,
        title: `Pause spend on ${product.name} — ROAS ${formatRatio(summary.roas)}`,
        body: `7-day spend ${formatMoney(summary.adSpendCents)} produced ${formatMoney(summary.revenueCents)} revenue and ${formatMoney(summary.netProfitCents)} net. Target ROAS is ${targetRoas}.`,
        evidence: { roas: summary.roas, targetRoas, spendCents: summary.adSpendCents },
      })
    } else if (summary.roas !== null && summary.roas >= targetRoas * 1.5 && summary.units >= 5) {
      report.findings.push(`${product.name}: ROAS ${formatRatio(summary.roas)} is well above target.`)
      await recommend({
        kind: 'scale',
        severity: 'info',
        product_id: product.id,
        title: `Consider more budget on ${product.name} — ROAS ${formatRatio(summary.roas)}`,
        body: `7-day: ${summary.units} unit(s), ${formatMoney(summary.netProfitCents)} net after ad spend. Raise budget in steps of 20–30% and re-check in 3 days.`,
        evidence: { roas: summary.roas, units: summary.units },
      })
    }
  }
  return report
}

/** Pulls real spend from Meta so the ROAS checks above run against fresh figures. */
export async function jobImportAdSpend(): Promise<JobReport> {
  const report: JobReport = { job: 'ad-import', checked: 0, findings: [], errors: [] }

  if (!isMetaConfigured()) {
    report.findings.push(
      'Meta Ads is not configured — skipped. Ad spend entered by hand in /ops/books is still counted.'
    )
    return report
  }

  const to = todayIso()
  const from = daysAgoIso(3)

  try {
    const summary = await importMetaMetrics(from, to)
    report.checked = summary.rowsFetched
    report.findings.push(
      `Imported ${summary.rowsWritten} Meta row(s) for ${from}..${to}: ${formatMoney(summary.spendCents)} spend, ${summary.purchases} purchase(s).`
    )
    if (summary.unattributed > 0) {
      report.findings.push(`${summary.unattributed} row(s) could not be attributed to a product.`)
      await recommend({
        kind: 'investigate',
        severity: 'warning',
        title: `${summary.unattributedCampaigns.length} Meta campaign(s) are not attributed to a product`,
        body: `Spend on these campaigns counts toward total ad spend but not toward any product P&L, so per-product ROAS is understated. Add a [vsp:<product-slug>] marker to the campaign name in Ads Manager, or map it in /ops/marketing.\n\n${summary.unattributedCampaigns
          .slice(0, 5)
          .map((c) => `${c.campaignRef}: ${formatMoney(c.spendCents)}`)
          .join('\n')}`,
        evidence: { campaigns: summary.unattributedCampaigns },
      })
    }
  } catch (err) {
    // An import failure must not be silent: without it, ROAS below is computed
    // against stale spend and every recommendation that follows is wrong.
    const message =
      err instanceof MetaApiError ? `${err.message}${err.hint ? ` — ${err.hint}` : ''}` : String(err)
    report.errors.push(message)
    await recommend({
      kind: 'investigate',
      severity: 'critical',
      title: 'Meta ad spend import failed',
      body: `Today's advertising figures may be stale, which makes every ROAS-based recommendation unreliable until it is fixed.\n\n${message}`,
      evidence: { from, to },
    })
  }

  return report
}

// --- WEEKLY ----------------------------------------------------------------

/** Products sitting in a stage with their checklist unfinished. */
export async function jobStalledResearch(): Promise<JobReport> {
  const report: JobReport = { job: 'stalled-research', checked: 0, findings: [], errors: [] }
  const [products, progress] = await Promise.all([listProducts({}), listAllChecklistProgress()])
  const twoWeeksAgo = Date.now() - 14 * 86_400_000

  for (const product of products) {
    const stage = stageForStatus(product.status)
    if (!stage) continue
    const items = CHECKLISTS[stage]
    const done = progress.filter((p) => p.product_id === product.id && p.stage === stage && p.done)
    if (done.length >= items.length) continue

    report.checked += 1
    if (new Date(product.updated_at).getTime() > twoWeeksAgo) continue

    const outstanding = items.filter((i) => !done.some((d) => d.item_key === i.key))
    report.findings.push(
      `${product.name} has been in "${stage}" for over two weeks with ${outstanding.length} step(s) outstanding.`
    )
    await recommend({
      kind: 'investigate',
      severity: 'info',
      product_id: product.id,
      title: `${product.name} is stalled in ${stage}`,
      body: `Untouched for more than two weeks. Outstanding:\n\n${outstanding.map((i) => `• ${i.label}`).join('\n')}\n\nFinish it or reject it — a candidate parked indefinitely costs attention without producing an answer.`,
      evidence: { stage, outstanding: outstanding.map((i) => i.key) },
    })
  }
  return report
}

/** Classify winners and losers, and ask for a post-mortem where one is missing. */
export async function jobWeeklyReview(): Promise<JobReport> {
  const report: JobReport = { job: 'weekly-review', checked: 0, findings: [], errors: [] }
  const targetRoas = await getSetting<number>('target_roas', 2)
  const since = daysAgoIso(30)
  const [products, sales, adMetrics, postmortems] = await Promise.all([
    listProducts({}),
    listSales(since),
    listAdMetrics(since),
    listPostmortems(),
  ])

  const pnl = computeProductPnl(products, sales, adMetrics)
  const written = new Set(postmortems.map((p) => p.product_id))

  for (const { product, summary } of pnl) {
    if (summary.units === 0 && summary.adSpendCents === 0) continue
    report.checked += 1

    const testing = product.status === 'testing'
    if (testing && summary.roas !== null && summary.roas >= targetRoas && summary.units >= 10) {
      report.findings.push(`${product.name} looks like a winner over 30 days.`)
      await recommend({
        kind: 'scale',
        severity: 'info',
        product_id: product.id,
        title: `Mark ${product.name} a winner?`,
        body: `30-day: ${summary.units} unit(s), ${formatMoney(summary.revenueCents)} revenue, ${formatMoney(summary.netProfitCents)} net, ROAS ${formatRatio(summary.roas)} against a ${targetRoas} target.`,
        evidence: { roas: summary.roas, units: summary.units },
      })
    }

    if (testing && summary.netProfitCents < 0 && summary.adSpendCents > 0) {
      report.findings.push(`${product.name} is losing money over 30 days.`)
      await recommend({
        kind: 'pause',
        severity: 'warning',
        product_id: product.id,
        title: `${product.name} is ${formatMoney(Math.abs(summary.netProfitCents))} down over 30 days`,
        body: `Spend ${formatMoney(summary.adSpendCents)} against ${formatMoney(summary.revenueCents)} revenue. Kill it or change one variable — creative, price or audience — and give it a defined budget and deadline.`,
        evidence: { netProfitCents: summary.netProfitCents },
      })
    }

    // A finished product with no post-mortem is a lesson thrown away.
    const finished = product.status === 'winner' || product.status === 'loser'
    if (finished && !written.has(product.id)) {
      report.findings.push(`${product.name} is finished but has no post-mortem.`)
      await recommend({
        kind: 'investigate',
        severity: 'info',
        product_id: product.id,
        title: `Write the post-mortem for ${product.name}`,
        body: `It ended as a ${product.status} and nothing has been recorded about why. The pattern analysis across your products is only as good as the post-mortems behind it — five minutes now is worth more than the next product test.`,
        evidence: { status: product.status },
      })
    }
  }

  const margins = pnl.filter((p) => p.summary.grossMargin !== null && p.summary.grossMargin < 0.2)
  if (margins.length > 0) {
    report.findings.push(`${margins.length} product(s) are running under a 20% gross margin.`)
    await recommend({
      kind: 'price',
      severity: 'warning',
      title: `${margins.length} product(s) under 20% gross margin`,
      body: `Before advertising is even counted:\n\n${margins
        .map(
          (p) =>
            `• ${p.product.name}: ${p.summary.grossMargin !== null ? `${Math.round(p.summary.grossMargin * 100)}%` : '—'} on ${formatMoney(p.summary.revenueCents)}`
        )
        .join('\n')}\n\nA thin gross margin leaves nothing to pay for ads, and no amount of scale fixes it.`,
      evidence: { count: margins.length },
    })
  }

  return report
}

// --- Runner ----------------------------------------------------------------

const DAILY = [jobImportAdSpend, jobLedgerGaps, jobAdPerformance]
const WEEKLY = [jobStalledResearch, jobWeeklyReview]

export async function runAutomations(
  which: 'daily' | 'weekly' | 'all' = 'daily'
): Promise<AutomationRun> {
  const startedAt = new Date().toISOString()
  const before = (await listRecommendations('open')).length

  // Open recommendations are replaced rather than appended, so the list is
  // always "what is true now" instead of an ever-growing pile.
  await clearOpenRecommendations()

  const jobs = which === 'daily' ? DAILY : which === 'weekly' ? WEEKLY : [...DAILY, ...WEEKLY]
  const reports: JobReport[] = []

  for (const job of jobs) {
    try {
      reports.push(await job())
    } catch (err) {
      // One failing job must not abort the run, and must not pass unnoticed.
      const name = job.name || 'unknown'
      reports.push({ job: name, checked: 0, findings: [], errors: [String(err)] })
      await logEvent({
        kind: 'automation.job_failed',
        level: 'error',
        message: `Job ${name} threw: ${String(err)}`,
      })
    }
  }

  const after = (await listRecommendations('open')).length
  const finishedAt = new Date().toISOString()

  await logEvent({
    kind: 'automation.run',
    level: reports.some((r) => r.errors.length > 0) ? 'warn' : 'info',
    message: `Ran ${which}: ${reports.length} job(s), ${after} recommendation(s) open.`,
    data: { which, reports, previousOpen: before },
  })

  return { ran: which, startedAt, finishedAt, reports, recommendationsCreated: after }
}

/** Exported for the ops UI so it can name the jobs before running them. */
export const JOB_NAMES = {
  daily: ['ad-import', 'ledger-gaps', 'ad-performance'],
  weekly: ['stalled-research', 'weekly-review'],
}

export { safeDivide }
