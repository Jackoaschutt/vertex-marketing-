/**
 * Automation engine.
 *
 * Pure job functions with no scheduler coupling — invoked from
 * POST /api/commerce/automations/run (admin session or CRON_SECRET), so any
 * scheduler works.
 *
 * Nothing here mutates a live product's price or status. Jobs produce
 * recommendations; a human applies them. Automating money-affecting changes
 * without review is the wrong default for a store taking real payments.
 */

import { safeDivide } from '../money'
import { formatMoney, formatRatio } from '../money'
import { adapterFor } from '../suppliers/registry'
import { sendTemplate } from '../email'
import { computeProductPnl, daysAgoIso } from '../analytics/profit'
import {
  clearOpenRecommendations,
  createRecommendation,
  getSetting,
  getSupplier,
  listAdMetrics,
  listAbandonedCarts,
  listOrderItemsForOrders,
  listOrders,
  listProducts,
  listRecommendations,
  listSupplierLinks,
  listVariantsByIds,
  logEvent,
  updateAbandonedCart,
  updateSupplierLink,
} from '../db/repo'
import { syncOrderTracking } from '../orders/pipeline'
import { isMetaConfigured, MetaApiError } from '../marketing/adapter-meta'
import { importMetaMetrics } from '../marketing/import'
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

/** Supplier inventory drift and low stock. */
export async function jobInventory(): Promise<JobReport> {
  const report: JobReport = { job: 'supplier-inventory', checked: 0, findings: [], errors: [] }
  const threshold = await getSetting<number>('low_stock_threshold', 10)
  const links = await listSupplierLinks()
  const variants = await listVariantsByIds(links.map((l) => l.variant_id))

  for (const link of links) {
    const variant = variants.find((v) => v.id === link.variant_id)
    if (!variant) continue
    report.checked += 1
    try {
      const supplier = await getSupplier(link.supplier_id)
      const adapter = adapterFor(supplier)
      const level = await adapter.getInventory(link.supplier_sku)
      if (level.available === null) continue

      await updateSupplierLink(link.id, { last_synced_at: level.checkedAt })

      if (level.available <= 0) {
        report.findings.push(`${variant.sku}: supplier reports out of stock.`)
        await recommend({
          kind: 'restock',
          severity: 'critical',
          product_id: variant.product_id,
          title: `${variant.sku} is out of stock at the supplier`,
          body: 'Unpublish the variant or switch to a backup supplier before more orders come in.',
          evidence: { supplierSku: link.supplier_sku, available: 0 },
        })
      } else if (level.available <= threshold) {
        report.findings.push(`${variant.sku}: only ${level.available} units at the supplier.`)
        await recommend({
          kind: 'restock',
          severity: 'warning',
          product_id: variant.product_id,
          title: `${variant.sku} is low at the supplier (${level.available} units)`,
          body: `Below the ${threshold}-unit threshold. Consider pausing ads for this variant or sourcing a backup.`,
          evidence: { supplierSku: link.supplier_sku, available: level.available, threshold },
        })
      }
    } catch (err) {
      report.errors.push(`${link.supplier_sku}: ${String(err)}`)
    }
  }
  return report
}

/** Supplier price drift that erodes margin. */
export async function jobPriceDrift(): Promise<JobReport> {
  const report: JobReport = { job: 'supplier-price', checked: 0, findings: [], errors: [] }
  const links = await listSupplierLinks()
  const variants = await listVariantsByIds(links.map((l) => l.variant_id))

  for (const link of links) {
    const variant = variants.find((v) => v.id === link.variant_id)
    if (!variant) continue
    report.checked += 1
    try {
      const supplier = await getSupplier(link.supplier_id)
      const adapter = adapterFor(supplier)
      const price = await adapter.getPrice(link.supplier_sku)
      const delta = price.costCents - link.supplier_cost_cents
      if (Math.abs(delta) < 25) continue

      const pct = safeDivide(delta, link.supplier_cost_cents)
      const direction = delta > 0 ? 'increased' : 'decreased'
      report.findings.push(
        `${variant.sku}: supplier cost ${direction} by ${formatMoney(Math.abs(delta))}.`
      )
      if (delta > 0) {
        const newMargin = safeDivide(variant.price_cents - price.costCents, variant.price_cents)
        await recommend({
          kind: 'price',
          severity: newMargin !== null && newMargin < 0.45 ? 'critical' : 'warning',
          product_id: variant.product_id,
          title: `Supplier cost for ${variant.sku} rose by ${formatMoney(delta)}`,
          body: `Cost is now ${formatMoney(price.costCents)} against a ${formatMoney(variant.price_cents)} retail price. Gross margin would be ${newMargin === null ? '—' : `${(newMargin * 100).toFixed(0)}%`}. Review the retail price or the supplier.`,
          evidence: { was: link.supplier_cost_cents, now: price.costCents, changePct: pct },
        })
      }
    } catch (err) {
      report.errors.push(`${link.supplier_sku}: ${String(err)}`)
    }
  }
  return report
}

/** Orders needing a human, and orders shipped without tracking. */
export async function jobOrderHealth(): Promise<JobReport> {
  const report: JobReport = { job: 'order-health', checked: 0, findings: [], errors: [] }

  const stuck = await listOrders({ status: 'needs_attention', limit: 200 })
  report.checked += stuck.length
  if (stuck.length > 0) {
    report.findings.push(`${stuck.length} order(s) need attention.`)
    await recommend({
      kind: 'investigate',
      severity: 'critical',
      title: `${stuck.length} order(s) are stuck and need attention`,
      body: stuck
        .slice(0, 5)
        .map((o) => `${o.order_number}: ${o.attention_reason ?? 'unknown reason'}`)
        .join('\n'),
      evidence: { orderNumbers: stuck.map((o) => o.order_number) },
    })
  }

  // Poll tracking for anything submitted or fulfilled but not yet delivered.
  const open = await listOrders({ status: ['submitted', 'fulfilled'], limit: 300 })
  report.checked += open.length
  for (const order of open) {
    try {
      const sync = await syncOrderTracking(order.id)
      if (sync.updated > 0) report.findings.push(`${order.order_number}: ${sync.updated} fulfilment update(s).`)
    } catch (err) {
      report.errors.push(`${order.order_number}: ${String(err)}`)
    }
  }

  // Submitted a while ago with no movement at all.
  const cutoff = daysAgoIso(5)
  const stale = open.filter((o) => o.status === 'submitted' && o.placed_at < cutoff)
  if (stale.length > 0) {
    report.findings.push(`${stale.length} order(s) submitted over 5 days ago with no tracking.`)
    await recommend({
      kind: 'investigate',
      severity: 'warning',
      title: `${stale.length} order(s) have no tracking after 5 days`,
      body: 'Chase the supplier. Customers usually contact support at about day seven.',
      evidence: { orderNumbers: stale.map((o) => o.order_number) },
    })
  }

  return report
}

/** Abandoned-cart recovery email, sent once, at least an hour after abandonment. */
export async function jobAbandonedCarts(): Promise<JobReport> {
  const report: JobReport = { job: 'abandoned-carts', checked: 0, findings: [], errors: [] }
  const carts = await listAbandonedCarts(100)
  const hourAgo = Date.now() - 3_600_000

  for (const cart of carts) {
    report.checked += 1
    if (!cart.email || cart.reminded_at) continue
    if (Date.parse(cart.created_at) > hourAgo) continue
    try {
      const result = await sendTemplate('abandoned_cart', cart.email, {
        cartValueCents: cart.value_cents,
      })
      await updateAbandonedCart(cart.id, { reminded_at: new Date().toISOString() })
      if (result.sent) report.findings.push(`Reminder sent to ${cart.email}.`)
    } catch (err) {
      report.errors.push(`${cart.email}: ${String(err)}`)
    }
  }
  return report
}

/**
 * Pulls yesterday and today from Meta before the ROAS check runs, so
 * recommendations are made against current spend rather than a stale snapshot.
 *
 * A 3-day window rather than 1: Meta's attribution keeps revising recent days
 * for up to 72 hours, and the import is idempotent, so re-pulling corrects
 * earlier figures instead of double-counting them.
 */
export async function jobImportAdSpend(): Promise<JobReport> {
  const report: JobReport = { job: 'ad-import', checked: 0, findings: [], errors: [] }

  if (!isMetaConfigured()) {
    report.findings.push(
      'Meta Ads is not configured — skipped. Ad spend entered manually in /ops/marketing is still counted.'
    )
    return report
  }

  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)

  try {
    const summary = await importMetaMetrics(from, to)
    report.checked = summary.rowsFetched
    report.findings.push(
      `Imported ${summary.rowsWritten} Meta row(s) for ${from}..${to}: ${formatMoney(summary.spendCents)} spend, ${summary.purchases} purchase(s).`
    )
    if (summary.unattributed > 0) {
      report.findings.push(
        `${summary.unattributed} row(s) could not be attributed to a product.`
      )
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
    // against stale spend and the recommendations that follow are wrong.
    const message = err instanceof MetaApiError ? `${err.message}${err.hint ? ` — ${err.hint}` : ''}` : String(err)
    report.errors.push(message)
    await recommend({
      kind: 'investigate',
      severity: 'critical',
      title: 'Meta ad spend import failed',
      body: `Today's advertising figures may be stale, which makes every ROAS-based recommendation below unreliable until it is fixed.\n\n${message}`,
      evidence: { from, to },
    })
  }

  return report
}

/** Daily advertising check against the target ROAS. */
export async function jobAdPerformance(): Promise<JobReport> {
  const report: JobReport = { job: 'ad-performance', checked: 0, findings: [], errors: [] }
  const targetRoas = await getSetting<number>('target_roas', 2)
  const since = daysAgoIso(7)
  const [products, orders, adMetrics] = await Promise.all([
    listProducts({}),
    listOrders({ since, limit: 1000 }),
    listAdMetrics(since.slice(0, 10)),
  ])

  if (adMetrics.length === 0) {
    report.findings.push('No ad metrics recorded in the last 7 days — advertising checks were skipped.')
    return report
  }

  const items = await listOrderItemsForOrders(orders.map((o) => o.id))
  const pnl = computeProductPnl(products, orders, items, adMetrics)

  for (const p of pnl) {
    if (p.adSpendCents === 0) continue
    report.checked += 1
    if (p.roas !== null && p.roas < targetRoas * 0.6) {
      report.findings.push(`${p.product.name}: ROAS ${formatRatio(p.roas)} is well below target.`)
      await recommend({
        kind: 'pause',
        severity: 'critical',
        product_id: p.product.id,
        title: `Pause spend on ${p.product.name} — ROAS ${formatRatio(p.roas)}`,
        body: `7-day spend ${formatMoney(p.adSpendCents)} produced ${formatMoney(p.revenueCents)} revenue and ${formatMoney(p.netProfitCents)} net. Target ROAS is ${targetRoas}.`,
        evidence: { roas: p.roas, targetRoas, spendCents: p.adSpendCents },
      })
    } else if (p.roas !== null && p.roas >= targetRoas * 1.5 && p.orders >= 5) {
      report.findings.push(`${p.product.name}: ROAS ${formatRatio(p.roas)} is well above target.`)
      await recommend({
        kind: 'scale',
        severity: 'info',
        product_id: p.product.id,
        title: `Consider more budget on ${p.product.name} — ROAS ${formatRatio(p.roas)}`,
        body: `7-day: ${p.orders} orders, ${formatMoney(p.netProfitCents)} net after ad spend. Raise budget in steps of 20–30% and re-check in 3 days.`,
        evidence: { roas: p.roas, orders: p.orders },
      })
    }
  }
  return report
}

// --- WEEKLY ----------------------------------------------------------------

/** Classify winners and losers, and suggest what to test, pause and reprice. */
export async function jobWeeklyReview(): Promise<JobReport> {
  const report: JobReport = { job: 'weekly-review', checked: 0, findings: [], errors: [] }
  const targetRoas = await getSetting<number>('target_roas', 2)
  const since = daysAgoIso(30)
  const [products, orders, adMetrics] = await Promise.all([
    listProducts({}),
    listOrders({ since, limit: 2000 }),
    listAdMetrics(since.slice(0, 10)),
  ])
  const items = await listOrderItemsForOrders(orders.map((o) => o.id))
  const pnl = computeProductPnl(products, orders, items, adMetrics)

  for (const p of pnl) {
    report.checked += 1
    const status = p.product.status

    if (status === 'testing' && p.orders >= 10 && p.roas !== null) {
      if (p.roas >= targetRoas) {
        await recommend({
          kind: 'scale',
          severity: 'info',
          product_id: p.product.id,
          title: `${p.product.name} looks like a winner — mark it and scale`,
          body: `${p.orders} orders at ROAS ${formatRatio(p.roas)} over 30 days, net ${formatMoney(p.netProfitCents)}. Move it from testing to winner and raise budget.`,
          evidence: { orders: p.orders, roas: p.roas },
        })
        report.findings.push(`${p.product.name}: winner candidate.`)
      } else {
        await recommend({
          kind: 'pause',
          severity: 'warning',
          product_id: p.product.id,
          title: `${p.product.name} is not clearing the bar in testing`,
          body: `${p.orders} orders at ROAS ${formatRatio(p.roas)} against a ${targetRoas} target, net ${formatMoney(p.netProfitCents)}. Either change the creative angle or mark it a loser and move on.`,
          evidence: { orders: p.orders, roas: p.roas, targetRoas },
        })
        report.findings.push(`${p.product.name}: loser candidate.`)
      }
    }

    if (p.refundRate !== null && p.refundRate > 0.08 && p.orders >= 10) {
      await recommend({
        kind: 'investigate',
        severity: 'warning',
        product_id: p.product.id,
        title: `${p.product.name} refund rate is ${(p.refundRate * 100).toFixed(0)}%`,
        body: 'Above 8% usually means the product page is overselling, the delivery window is unclear, or quality is inconsistent. Check the recent order notes before spending more.',
        evidence: { refundRate: p.refundRate, orders: p.orders },
      })
    }

    const margin = safeDivide(p.grossProfitCents, p.revenueCents)
    if (margin !== null && margin < 0.45 && p.orders >= 5) {
      await recommend({
        kind: 'price',
        severity: 'warning',
        product_id: p.product.id,
        title: `${p.product.name} gross margin is ${(margin * 100).toFixed(0)}%`,
        body: `Below 45% there is little room for ad costs. Options: raise price, negotiate cost, or bundle it with a higher-margin product.`,
        evidence: { margin, revenueCents: p.revenueCents },
      })
    }

    if (
      (status === 'winner' || status === 'scaling') &&
      p.adSpendCents > 0 &&
      p.roas !== null &&
      p.roas < targetRoas
    ) {
      await recommend({
        kind: 'creative',
        severity: 'info',
        product_id: p.product.id,
        title: `Refresh creative for ${p.product.name}`,
        body: `A previously strong product has fallen to ROAS ${formatRatio(p.roas)}. That pattern usually means creative fatigue rather than a broken product. Generate new angles from the product's AI content set and test three at once.`,
        evidence: { roas: p.roas },
      })
    }
  }

  // What to test next: highest-scoring approved products with no ad spend yet.
  const untested = products
    .filter((p) => p.status === 'approved' && p.ad_spend_cents === 0)
    .sort((a, b) => b.product_score - a.product_score)
    .slice(0, 3)
  for (const p of untested) {
    await recommend({
      kind: 'investigate',
      severity: 'info',
      product_id: p.id,
      title: `Test ${p.name} next (score ${p.product_score}/100)`,
      body: 'Approved, never advertised, and the highest-scoring candidate not yet in market.',
      evidence: { score: p.product_score },
    })
    report.findings.push(`${p.name}: queued as a test candidate.`)
  }

  return report
}

// --- Runner ----------------------------------------------------------------

export async function runAutomations(which: 'daily' | 'weekly' | 'all' = 'daily'): Promise<AutomationRun> {
  const startedAt = new Date().toISOString()

  // Recommendations are regenerated each run rather than accumulating, so the
  // list always reflects current state instead of a growing pile of history.
  await clearOpenRecommendations()

  const reports: JobReport[] = []
  // Order matters: the import runs before the ROAS check so recommendations
  // are made against fresh spend.
  const daily = [
    jobInventory,
    jobPriceDrift,
    jobOrderHealth,
    jobAbandonedCarts,
    jobImportAdSpend,
    jobAdPerformance,
  ]
  const weekly = [jobWeeklyReview]

  const toRun = which === 'daily' ? daily : which === 'weekly' ? weekly : [...daily, ...weekly]

  for (const job of toRun) {
    try {
      reports.push(await job())
    } catch (err) {
      reports.push({
        job: job.name,
        checked: 0,
        findings: [],
        errors: [`Job threw: ${String(err)}`],
      })
    }
  }

  const recommendationsCreated = (await listRecommendations('open')).length

  const finishedAt = new Date().toISOString()
  await logEvent({
    kind: 'automation.run',
    level: reports.some((r) => r.errors.length > 0) ? 'warn' : 'info',
    message: `Automation run (${which}): ${reports.length} job(s), ${recommendationsCreated} recommendation(s).`,
    data: { reports },
  })

  return { ran: which, startedAt, finishedAt, reports, recommendationsCreated }
}
