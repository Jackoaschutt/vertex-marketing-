/**
 * System inventory — what exists, what it does, and whether it is real.
 *
 * This backs /ops/system. Two kinds of information are combined:
 *
 *   1. LIVE state — integration configuration, table row counts, the last
 *      automation run, open recommendations. Read at request time.
 *   2. A curated MANIFEST of modules and routes. Hand-maintained, but every
 *      `file` path in it is asserted to exist by tests/system.test.ts, so a
 *      deleted or renamed module fails the test suite rather than silently
 *      leaving a lie on the page.
 */

import { capabilities, config, type Capability } from './config'
import { getDriver, TABLES } from './db'
import { listEvents, listProducts, listRecommendations } from './db/repo'
import type { CommerceEvent } from './types'

export type Maturity = 'REAL' | 'MOCK' | 'TODO' | 'UNVERIFIED'

export interface ModuleEntry {
  name: string
  file: string
  purpose: string
  maturity: Maturity
  note?: string
}

export interface RouteEntry {
  path: string
  file: string
  kind: 'storefront' | 'admin' | 'api' | 'generated'
  auth: 'public' | 'admin' | 'admin or cron' | 'signature' | 'none'
  purpose: string
}

export interface TableEntry {
  table: string
  purpose: string
}

// --- Manifest --------------------------------------------------------------

export const MODULES: ModuleEntry[] = [
  // Foundation
  { name: 'Brand + policy', file: 'lib/commerce/brand.ts', purpose: 'Naming and voice used by the AI content pipeline. Vestigial now that there is no storefront, kept because content generation still reads it.', maturity: 'REAL' },
  { name: 'Capability detection', file: 'lib/commerce/config.ts', purpose: 'Answers "is X actually configured?" so the UI can tell the truth instead of pretending an integration works.', maturity: 'REAL' },
  { name: 'Money', file: 'lib/commerce/money.ts', purpose: 'Integer minor units everywhere. Rates return null rather than NaN or a misleading zero.', maturity: 'REAL' },
  { name: 'Validation', file: 'lib/commerce/validate.ts', purpose: 'Hand-rolled request validation. No new dependency for a small surface.', maturity: 'REAL' },
  { name: 'Admin authorisation', file: 'lib/commerce/auth.ts', purpose: 'Supabase session plus an email allowlist. An empty allowlist denies everyone by design.', maturity: 'REAL' },
  { name: 'Route helpers', file: 'lib/commerce/http.ts', purpose: 'JSON responses, error translation, sliding-window rate limiting.', maturity: 'REAL' },

  // Data
  { name: 'Storage driver contract', file: 'lib/commerce/db/driver.ts', purpose: 'The interface both drivers implement. Repositories never import a driver directly.', maturity: 'REAL' },
  { name: 'Supabase driver', file: 'lib/commerce/db/driver-supabase.ts', purpose: 'Postgres via the service-role key. The only module that touches it.', maturity: 'REAL' },
  { name: 'Demo driver', file: 'lib/commerce/db/driver-memory.ts', purpose: 'Seeded in-process storage so the whole tool runs with zero credentials. Resets on restart.', maturity: 'MOCK', note: 'Active only when no database is configured.' },
  { name: 'Database health', file: 'lib/commerce/db/health.ts', purpose: 'Turns a connection failure into a message naming the cause and the fix, instead of an opaque error digest.', maturity: 'REAL' },
  { name: 'Repositories', file: 'lib/commerce/db/repo.ts', purpose: 'The only API the rest of the system uses to reach storage.', maturity: 'REAL' },

  // Research
  { name: 'Scoring rubric', file: 'lib/commerce/research/scoring.ts', purpose: '100-point rubric plus the lifecycle machine. Margin and shipping are computed from real numbers, not judged.', maturity: 'REAL' },
  { name: 'Stage checklists', file: 'lib/commerce/research/checklist.ts', purpose: 'The process written down: 23 steps across research, validation, testing, scaling and review, each with the reason it exists.', maturity: 'REAL' },
  { name: 'Cause vocabulary', file: 'lib/commerce/research/factors.ts', purpose: 'The fixed list of causes a post-mortem can be tagged with, so patterns across products can be counted rather than felt.', maturity: 'REAL' },
  { name: 'Signal collector', file: 'lib/commerce/research/signals.ts', purpose: 'Fetches real demand and competition data from SerpAPI and stores the raw payload so any score can be traced back.', maturity: 'REAL', note: 'Needs SERPAPI_KEY. Without it the interface reports that no signal could be collected — it never invents a trend.' },

  // Sourcing
  { name: 'Supplier contract', file: 'lib/commerce/suppliers/types.ts', purpose: 'One interface every supplier implements, used for cost and catalogue lookup.', maturity: 'REAL' },
  { name: 'Mock supplier', file: 'lib/commerce/suppliers/adapter-mock.ts', purpose: 'Simulated catalogue so sourcing lookups can be exercised without an account.', maturity: 'MOCK', note: 'Every response tagged __mock. Never a real cost.' },
  { name: 'Generic HTTP supplier', file: 'lib/commerce/suppliers/adapter-http.ts', purpose: 'Config-driven adapter for any supplier with a JSON API.', maturity: 'REAL' },
  { name: 'CJdropshipping', file: 'lib/commerce/suppliers/adapter-cj.ts', purpose: 'CJ Developer API v2 — product and price lookup for sourcing research.', maturity: 'UNVERIFIED', note: 'Written to published API shapes but never run against a live account.' },

  // Books
  { name: 'Profit engine', file: 'lib/commerce/analytics/profit.ts', purpose: 'Computes every financial figure from the ledger, ad spend and expenses. Nothing is cached back onto a product, so there is exactly one answer to what something earned.', maturity: 'REAL' },

  // Marketing
  { name: 'Ad channel contract', file: 'lib/commerce/marketing/channels.ts', purpose: 'One interface per ad platform, plus the registry.', maturity: 'REAL' },
  { name: 'Meta Ads client', file: 'lib/commerce/marketing/adapter-meta.ts', purpose: 'Daily insights import and campaign creation, with purchase de-duplication so ROAS cannot be inflated.', maturity: 'UNVERIFIED', note: 'Written to the documented Marketing API but never run against a live ad account. Run the status check first.' },
  { name: 'Ad metric import', file: 'lib/commerce/marketing/import.ts', purpose: 'Pulls channel performance into ds_ad_metrics and attributes campaigns back to products.', maturity: 'REAL' },

  // AI
  { name: 'Anthropic client', file: 'lib/commerce/ai/client.ts', purpose: 'One wrapper, structured JSON output. Returns null on failure so callers use their deterministic fallback.', maturity: 'REAL' },
  { name: 'Content pipeline', file: 'lib/commerce/ai/content.ts', purpose: 'Ad angles, hooks and copy for testing elsewhere.', maturity: 'REAL' },
  { name: 'Truthfulness guardrails', file: 'lib/commerce/ai/guardrails.ts', purpose: 'Post-generation scan that strips invented statistics, medical claims, reviews, scarcity and guarantees.', maturity: 'REAL' },
  { name: 'Coach', file: 'lib/commerce/ai/analyst.ts', purpose: 'Computes the metric bundle from the ledger first, then answers only from it, reasoning about causes from your own post-mortems. Rules engine without an API key.', maturity: 'REAL' },

  // Automation
  { name: 'Automation jobs', file: 'lib/commerce/automation/jobs.ts', purpose: 'Ledger-gap detection, ROAS checks, stalled research and the weekly review. Output is advisory — nothing is changed for you.', maturity: 'REAL' },

  // This page
  { name: 'System inventory', file: 'lib/commerce/system.ts', purpose: 'Backs this page. Manifest paths are asserted to exist by the test suite.', maturity: 'REAL' },
]

export const ROUTES: RouteEntry[] = [
  { path: '/ops', file: 'app/ops/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Overview — profit by window, chart, best and worst, what needs a decision, the coach.' },
  { path: '/ops/books', file: 'app/ops/books/page.tsx', kind: 'admin', auth: 'admin', purpose: 'The ledger. Enter a day of sales, record expenses, see the month and all-time P&L.' },
  { path: '/ops/research', file: 'app/ops/research/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Scoring console with a live rubric breakdown.' },
  { path: '/ops/products', file: 'app/ops/products/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Every candidate, its score, its stage progress and what it actually earned.' },
  { path: '/ops/playbook', file: 'app/ops/playbook/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Your own notes, lessons, ideas and sources, searchable and linkable to products.' },
  { path: '/ops/postmortems', file: 'app/ops/postmortems/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Why each finished product won or died, plus the pattern across all of them.' },
  { path: '/ops/analytics', file: 'app/ops/analytics/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Per-product contribution, revenue by channel, where the overheads went.' },
  { path: '/ops/marketing', file: 'app/ops/marketing/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Ad spend, Meta import, blended and per-product return.' },
  { path: '/ops/suppliers', file: 'app/ops/suppliers/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Sourcing reference: landed cost and modelled margin per candidate.' },
  { path: '/ops/automations', file: 'app/ops/automations/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Run the jobs, read the recommendations, read the event log.' },
  { path: '/ops/settings', file: 'app/ops/settings/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Integration status and operating parameters.' },
  { path: '/ops/system', file: 'app/ops/system/page.tsx', kind: 'admin', auth: 'admin', purpose: 'This page — everything that exists and whether it is real.' },

  { path: '/api/commerce/books/sales', file: 'app/api/commerce/books/sales/route.ts', kind: 'api', auth: 'admin', purpose: 'Record a day of sales. Upserts, so re-entering corrects rather than double-counts.' },
  { path: '/api/commerce/books/expenses', file: 'app/api/commerce/books/expenses/route.ts', kind: 'api', auth: 'admin', purpose: 'Record an overhead.' },
  { path: '/api/commerce/learning/notes', file: 'app/api/commerce/learning/notes/route.ts', kind: 'api', auth: 'admin', purpose: 'Write, edit and delete playbook entries.' },
  { path: '/api/commerce/learning/checklist', file: 'app/api/commerce/learning/checklist/route.ts', kind: 'api', auth: 'admin', purpose: 'Tick a stage step. Rejects keys that are not in the checklist definition.' },
  { path: '/api/commerce/learning/postmortem', file: 'app/api/commerce/learning/postmortem/route.ts', kind: 'api', auth: 'admin', purpose: 'Write a post-mortem, snapshotting the figures it was written about.' },
  { path: '/api/commerce/research/score', file: 'app/api/commerce/research/score/route.ts', kind: 'api', auth: 'admin', purpose: 'Stateless scoring for the research console.' },
  { path: '/api/commerce/research/signals', file: 'app/api/commerce/research/signals/route.ts', kind: 'api', auth: 'admin', purpose: 'Collect real demand and competition signals for a keyword.' },
  { path: '/api/commerce/products', file: 'app/api/commerce/products/route.ts', kind: 'api', auth: 'admin', purpose: 'List and create candidates.' },
  { path: '/api/commerce/products/[id]', file: 'app/api/commerce/products/[id]/route.ts', kind: 'api', auth: 'admin', purpose: 'Read, update (lifecycle rules enforced), delete. Refuses to delete anything with ledger history.' },
  { path: '/api/commerce/content/generate', file: 'app/api/commerce/content/generate/route.ts', kind: 'api', auth: 'admin', purpose: 'Generates ad angles and copy, saved unapproved.' },
  { path: '/api/commerce/analyst', file: 'app/api/commerce/analyst/route.ts', kind: 'api', auth: 'admin', purpose: 'Grounded question answering over your live figures and post-mortems.' },
  { path: '/api/commerce/automations/run', file: 'app/api/commerce/automations/run/route.ts', kind: 'api', auth: 'admin or cron', purpose: 'Runs the daily or weekly job set.' },
  { path: '/api/commerce/marketing/spend', file: 'app/api/commerce/marketing/spend/route.ts', kind: 'api', auth: 'admin', purpose: 'Manual ad-spend entry, upserted per day.' },
  { path: '/api/commerce/marketing/meta/status', file: 'app/api/commerce/marketing/meta/status/route.ts', kind: 'api', auth: 'admin', purpose: 'Round-trips the Graph API to prove token, account, version and permissions.' },
  { path: '/api/commerce/marketing/meta/import', file: 'app/api/commerce/marketing/meta/import/route.ts', kind: 'api', auth: 'admin or cron', purpose: 'Imports daily insights into ds_ad_metrics.' },
  { path: '/api/commerce/marketing/meta/campaign', file: 'app/api/commerce/marketing/meta/campaign/route.ts', kind: 'api', auth: 'admin', purpose: 'Creates a PAUSED campaign, ad set, creative and ad.' },
  { path: '/api/commerce/marketing/meta/map', file: 'app/api/commerce/marketing/meta/map/route.ts', kind: 'api', auth: 'admin', purpose: 'Attributes an existing campaign to a product.' },
]

export const TABLE_PURPOSE: TableEntry[] = [
  { table: TABLES.products, purpose: 'Catalogue and research record in one row: economics, nine score components, lifecycle.' },
  { table: TABLES.images, purpose: 'Product and creative reference images.' },
  { table: TABLES.content, purpose: 'Versioned AI-written copy and ad angles, tagged with the generator that produced them.' },
  { table: TABLES.suppliers, purpose: 'Where a candidate would be sourced, with lead times.' },
  { table: TABLES.sales, purpose: 'The ledger. One hand-entered row per product per channel per day — the only source of revenue truth.' },
  { table: TABLES.adMetrics, purpose: 'Daily spend and performance per product, channel and campaign.' },
  { table: TABLES.expenses, purpose: 'Costs that are neither goods nor advertising.' },
  { table: TABLES.notes, purpose: 'The playbook: lessons, ideas and sources, optionally tied to the product that taught them.' },
  { table: TABLES.checklist, purpose: 'Which stage steps have been completed for each product.' },
  { table: TABLES.postmortems, purpose: 'Why a product won or died, in the owner’s words, with tagged causes and a figures snapshot.' },
  { table: TABLES.signals, purpose: 'Research signals actually fetched from a provider, with the raw payload kept for traceability.' },
  { table: TABLES.recommendations, purpose: 'Automation output awaiting a decision.' },
  { table: TABLES.events, purpose: 'Append-only audit log of every transition, entry and failure.' },
  { table: TABLES.settings, purpose: 'Operator parameters and the Meta campaign map.' },
]

// --- Live state ------------------------------------------------------------

export interface ReadinessItem {
  label: string
  ready: boolean
  detail: string
  blocking: boolean
}

export interface SystemSnapshot {
  generatedAt: string
  demoMode: boolean
  capabilities: Capability[]
  readiness: ReadinessItem[]
  readyCount: number
  blockingCount: number
  tables: { table: string; purpose: string; rows: number | null }[]
  totals: { modules: number; routes: number; tables: number; products: number; scoredProducts: number }
  lastAutomationRun: CommerceEvent | null
  openRecommendations: number
  recentErrors: CommerceEvent[]
}

export async function buildSnapshot(): Promise<SystemSnapshot> {
  const caps = capabilities()
  const driver = getDriver()

  const [products, recommendations, automationEvents, errorEvents] = await Promise.all([
    listProducts({}),
    listRecommendations('open'),
    listEvents(200),
    listEvents(10, 'error'),
  ])

  const tables = await Promise.all(
    TABLE_PURPOSE.map(async (t) => {
      try {
        return { ...t, rows: await driver.count(t.table) }
      } catch {
        // A missing table is worth showing as unknown rather than crashing the
        // page — it usually means the migration has not been run.
        return { ...t, rows: null }
      }
    })
  )

  const capBy = (key: string) => caps.find((c) => c.key === key)
  const scoredProducts = products.filter((p) => p.product_score > 0).length
  const hasLedger = (await driver.count(TABLES.sales).catch(() => 0)) > 0

  const readiness: ReadinessItem[] = [
    {
      label: 'Passcode set',
      ready: config.passcodeConfigured,
      blocking: true,
      detail: config.passcodeConfigured
        ? 'One passcode gates everything. Changing it logs every device out.'
        : 'ADMIN_PASSCODE is empty, so this tool is closed to everyone including you.',
    },
    {
      label: 'Database connected',
      ready: config.databaseConfigured,
      blocking: true,
      detail: config.databaseConfigured
        ? 'Persisting to Postgres.'
        : 'Demo mode — seeded in-memory data that resets on restart. Nothing you enter is saved.',
    },
    {
      label: 'Something in the ledger',
      ready: hasLedger,
      blocking: true,
      detail: hasLedger
        ? 'The books have entries, so every figure is computed from something real.'
        : 'The ledger is empty, so every profit figure reads zero because nothing has been entered — not because nothing sold.',
    },
    {
      label: 'At least one candidate scored',
      ready: scoredProducts > 0,
      blocking: false,
      detail:
        scoredProducts > 0
          ? `${scoredProducts} candidate(s) scored.`
          : 'No candidate has been scored yet, so there is nothing to compare.',
    },
    {
      label: 'Demand data collected automatically',
      ready: config.serpApiConfigured,
      blocking: false,
      detail: config.serpApiConfigured
        ? 'SerpAPI is connected — trends and competition counts are fetched, not guessed.'
        : 'No SERPAPI_KEY. Demand and competition are scored by hand; the collector refuses to invent a trend.',
    },
    {
      label: 'Ad spend imports automatically',
      ready: config.metaConfigured,
      blocking: false,
      detail: capBy('ads')?.note ?? 'Manual entry in /ops/books produces real figures either way.',
    },
    {
      label: 'AI copy and coach',
      ready: config.anthropicConfigured,
      blocking: false,
      detail: config.anthropicConfigured
        ? `Using ${config.aiModel}.`
        : 'Deterministic fallbacks in use, badged in the UI. Usable, just not model-written.',
    },
    {
      label: 'Automations scheduled',
      ready: config.cronConfigured,
      blocking: false,
      detail: config.cronConfigured
        ? 'CRON_SECRET set — any scheduler can trigger the jobs.'
        : 'Jobs can still be run by hand from /ops/automations. Without them, a gap in the ledger goes unnoticed.',
    },
  ]

  return {
    generatedAt: new Date().toISOString(),
    demoMode: config.demoMode,
    capabilities: caps,
    readiness,
    readyCount: readiness.filter((r) => r.ready).length,
    blockingCount: readiness.filter((r) => r.blocking && !r.ready).length,
    tables,
    totals: {
      modules: MODULES.length,
      routes: ROUTES.length,
      tables: TABLE_PURPOSE.length,
      products: products.length,
      scoredProducts,
    },
    lastAutomationRun: automationEvents.find((e) => e.kind === 'automation.run') ?? null,
    openRecommendations: recommendations.length,
    recentErrors: errorEvents,
  }
}

/** Test coverage, stated as fact rather than a claim. Kept in step by tests/system.test.ts. */
export const VERIFICATION = [
  { area: 'Money handling', file: 'tests/money.test.ts', covers: 'Currency parsing, margins, and never returning NaN or Infinity.' },
  { area: 'Research rubric', file: 'tests/scoring.test.ts', covers: 'Weights summing to 100, derived margin and shipping scores, hard gates, legal lifecycle transitions.' },
  { area: 'AI guardrails', file: 'tests/guardrails.test.ts', covers: 'Detecting invented statistics, medical claims, reviews, scarcity, guarantees; leaving honest copy untouched.' },
  { area: 'Request validation', file: 'tests/validate.test.ts', covers: 'Malformed bodies, bounds, email, slugs, HTML escaping.' },
  { area: 'Profit engine', file: 'tests/profit.test.ts', covers: 'Revenue never reported as profit, refunds reducing revenue, rates returning null rather than zero, per-product attribution, unattributed spend reported not spread.' },
  { area: 'Meta transforms', file: 'tests/meta.test.ts', covers: 'Purchase de-duplication, row mapping, campaign markers, attribution precedence, range splitting, error translation.' },
  { area: 'Meta HTTP client', file: 'tests/meta-integration.test.ts', covers: 'Against a mock Graph API: auth header, cursor paging, campaign creation sequence, origin-checked paging links, error paths.' },
  { area: 'System inventory', file: 'tests/system.test.ts', covers: 'Every file path on this page exists, so the manifest cannot silently rot.' },
]
