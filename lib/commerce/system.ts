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
  { name: 'Brand + policy', file: 'lib/commerce/brand.ts', purpose: 'Single source of truth for name, voice, claim prohibitions, categories, shipping and returns policy. Rebranding the store is editing this file.', maturity: 'REAL' },
  { name: 'Capability detection', file: 'lib/commerce/config.ts', purpose: 'Answers "is X actually configured?" so the UI can tell the truth instead of pretending an integration works.', maturity: 'REAL' },
  { name: 'Money', file: 'lib/commerce/money.ts', purpose: 'Integer minor units everywhere. Rates return null rather than NaN or a misleading zero.', maturity: 'REAL' },
  { name: 'Validation', file: 'lib/commerce/validate.ts', purpose: 'Hand-rolled request validation. No new dependency for a small surface.', maturity: 'REAL' },
  { name: 'Admin authorisation', file: 'lib/commerce/auth.ts', purpose: 'Supabase session plus an email allowlist. An empty allowlist denies everyone by design.', maturity: 'REAL' },
  { name: 'Route helpers', file: 'lib/commerce/http.ts', purpose: 'JSON responses, error translation, sliding-window rate limiting.', maturity: 'REAL' },
  { name: 'SEO', file: 'lib/commerce/seo.ts', purpose: 'Metadata, canonicals, Open Graph, Product/Breadcrumb/FAQ JSON-LD. Never emits AggregateRating, because there is no review data.', maturity: 'REAL' },

  // Data
  { name: 'Storage driver contract', file: 'lib/commerce/db/driver.ts', purpose: 'The interface both drivers implement. Repositories never import a driver directly.', maturity: 'REAL' },
  { name: 'Supabase driver', file: 'lib/commerce/db/driver-supabase.ts', purpose: 'Postgres via the service-role key. The only module that touches it.', maturity: 'REAL' },
  { name: 'Demo driver', file: 'lib/commerce/db/driver-memory.ts', purpose: 'Seeded in-process storage so the whole system runs with zero credentials. Resets on restart.', maturity: 'MOCK', note: 'Active only when no database is configured.' },
  { name: 'Repositories', file: 'lib/commerce/db/repo.ts', purpose: 'The only API the rest of the system uses to reach storage.', maturity: 'REAL' },

  // Research
  { name: 'Scoring rubric', file: 'lib/commerce/research/scoring.ts', purpose: '100-point rubric plus the lifecycle machine. Margin and shipping are computed from real numbers, not judged.', maturity: 'REAL' },

  // Suppliers
  { name: 'Supplier contract', file: 'lib/commerce/suppliers/types.ts', purpose: 'One interface every supplier implements. Swapping supplier is a database change.', maturity: 'REAL' },
  { name: 'Mock supplier', file: 'lib/commerce/suppliers/adapter-mock.ts', purpose: 'Simulated catalogue and fulfilment so the pipeline can be exercised without an account.', maturity: 'MOCK', note: 'Every response tagged __mock. Never for real orders.' },
  { name: 'Generic HTTP supplier', file: 'lib/commerce/suppliers/adapter-http.ts', purpose: 'Config-driven adapter for any supplier with a JSON API. Preferred over forking the codebase.', maturity: 'REAL' },
  { name: 'CJdropshipping', file: 'lib/commerce/suppliers/adapter-cj.ts', purpose: 'CJ Developer API v2 — products, inventory, pricing, orders, tracking.', maturity: 'UNVERIFIED', note: 'Written to published API shapes but never run against a live account. Place one test order first.' },

  // Orders
  { name: 'Order creation', file: 'lib/commerce/orders/create.ts', purpose: 'Builds an order from a re-priced cart. Idempotent on the Stripe session id.', maturity: 'REAL' },
  { name: 'Fulfilment pipeline', file: 'lib/commerce/orders/pipeline.ts', purpose: 'Validate, split by supplier, submit, track, notify. Failure lands in needs_attention with the reason; retries are idempotent.', maturity: 'REAL' },
  { name: 'Cart pricing', file: 'lib/commerce/cart.ts', purpose: 'Server-side repricing. The browser stores only {variantId, qty}, so a tampered cart cannot change the charge.', maturity: 'REAL' },

  // Analytics
  { name: 'Profit engine', file: 'lib/commerce/analytics/profit.ts', purpose: 'Revenue, gross profit and net profit kept separate. Per-product P&L, ROAS, CPA, AOV, refund rate.', maturity: 'REAL' },
  { name: 'Attribution', file: 'lib/commerce/analytics/attribution.ts', purpose: 'UTM and click-id capture into a first-party cookie, attached to the order.', maturity: 'REAL' },

  // Marketing
  { name: 'Ad channel contract', file: 'lib/commerce/marketing/channels.ts', purpose: 'One interface per ad platform, plus the registry.', maturity: 'REAL' },
  { name: 'Meta Ads client', file: 'lib/commerce/marketing/adapter-meta.ts', purpose: 'Daily insights import and campaign creation. Ported from server.py with its gaps closed.', maturity: 'UNVERIFIED', note: 'Written to the documented Marketing API but never run against a live ad account. Run the status check first.' },
  { name: 'Ad metric import', file: 'lib/commerce/marketing/import.ts', purpose: 'Pulls channel performance into ds_ad_metrics and attributes campaigns back to products.', maturity: 'REAL' },

  // AI
  { name: 'Anthropic client', file: 'lib/commerce/ai/client.ts', purpose: 'One wrapper, structured JSON output. Returns null on failure so callers use their deterministic fallback.', maturity: 'REAL' },
  { name: 'Content pipeline', file: 'lib/commerce/ai/content.ts', purpose: 'Titles, copy, benefits, FAQ, meta tags, ad angles, UGC and TikTok hooks, image prompts.', maturity: 'REAL' },
  { name: 'Truthfulness guardrails', file: 'lib/commerce/ai/guardrails.ts', purpose: 'Post-generation scan that strips invented statistics, medical claims, reviews, scarcity and guarantees.', maturity: 'REAL' },
  { name: 'Business analyst', file: 'lib/commerce/ai/analyst.ts', purpose: 'Computes the metric bundle from the database first, then answers only from it. Rules engine without an API key.', maturity: 'REAL' },

  // Automation & email
  { name: 'Automation jobs', file: 'lib/commerce/automation/jobs.ts', purpose: 'Daily and weekly jobs. Output is advisory — nothing changes a live price or status without a human.', maturity: 'REAL' },
  { name: 'Email transports', file: 'lib/commerce/email/index.ts', purpose: 'Console (logs only) and Resend (delivers). Every send deduplicated per order and template.', maturity: 'REAL' },
  { name: 'Email templates', file: 'lib/commerce/email/templates.ts', purpose: 'Nine lifecycle emails. No urgency language, no invented claims.', maturity: 'REAL' },

  // This page
  { name: 'System inventory', file: 'lib/commerce/system.ts', purpose: 'Backs this page. Manifest paths are asserted to exist by the test suite.', maturity: 'REAL' },
]

export const ROUTES: RouteEntry[] = [
  { path: '/store', file: 'app/store/page.tsx', kind: 'storefront', auth: 'public', purpose: 'Home — positioning, categories, featured products.' },
  { path: '/store/shop', file: 'app/store/shop/page.tsx', kind: 'storefront', auth: 'public', purpose: 'Catalogue with category filter and sort.' },
  { path: '/store/product/[slug]', file: 'app/store/product/[slug]/page.tsx', kind: 'storefront', auth: 'public', purpose: 'Product detail, variants, sticky mobile buy bar, JSON-LD.' },
  { path: '/store/cart', file: 'app/store/cart/page.tsx', kind: 'storefront', auth: 'public', purpose: 'Cart, server-repriced on every view.' },
  { path: '/store/order/confirmed', file: 'app/store/order/confirmed/page.tsx', kind: 'storefront', auth: 'public', purpose: 'Post-checkout confirmation; clears the local cart.' },
  { path: '/store/contact', file: 'app/store/contact/page.tsx', kind: 'storefront', auth: 'public', purpose: 'Support form with a honeypot and rate limit.' },
  { path: '/store/pages/[slug]', file: 'app/store/pages/[slug]/page.tsx', kind: 'storefront', auth: 'public', purpose: 'About, FAQ, shipping, returns, privacy, terms.' },
  { path: '/store-sitemap.xml', file: 'app/store-sitemap.xml/route.ts', kind: 'generated', auth: 'public', purpose: 'Generated from live catalogue data.' },
  { path: '/robots.txt', file: 'app/robots.txt/route.ts', kind: 'generated', auth: 'public', purpose: 'Keeps admin, API and cart out of the index.' },

  { path: '/ops', file: 'app/ops/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Overview — today/week/month profit, charts, best and worst product, AI analyst.' },
  { path: '/ops/products', file: 'app/ops/products/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Catalogue, lifecycle transitions, publish, AI copy, delete.' },
  { path: '/ops/research', file: 'app/ops/research/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Scoring console with a live rubric breakdown.' },
  { path: '/ops/orders', file: 'app/ops/orders/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Orders, fulfilments, attention reasons, idempotent retry.' },
  { path: '/ops/suppliers', file: 'app/ops/suppliers/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Suppliers, adapters, variant mapping, credential status.' },
  { path: '/ops/customers', file: 'app/ops/customers/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Customers and lifetime totals.' },
  { path: '/ops/analytics', file: 'app/ops/analytics/page.tsx', kind: 'admin', auth: 'admin', purpose: 'P&L, per-product contribution, channel roll-up.' },
  { path: '/ops/marketing', file: 'app/ops/marketing/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Meta panel, manual spend, abandoned carts, email log.' },
  { path: '/ops/automations', file: 'app/ops/automations/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Run jobs, recommendations, event log.' },
  { path: '/ops/settings', file: 'app/ops/settings/page.tsx', kind: 'admin', auth: 'admin', purpose: 'Integration status and operating parameters.' },
  { path: '/ops/system', file: 'app/ops/system/page.tsx', kind: 'admin', auth: 'admin', purpose: 'This page — everything that exists and whether it is real.' },

  { path: '/api/commerce/cart/validate', file: 'app/api/commerce/cart/validate/route.ts', kind: 'api', auth: 'public', purpose: 'Re-prices a client cart from the database.' },
  { path: '/api/commerce/checkout', file: 'app/api/commerce/checkout/route.ts', kind: 'api', auth: 'public', purpose: 'Opens a Stripe Checkout Session from server-derived prices.' },
  { path: '/api/commerce/contact', file: 'app/api/commerce/contact/route.ts', kind: 'api', auth: 'public', purpose: 'Support form intake.' },
  { path: '/api/commerce/webhooks/stripe', file: 'app/api/commerce/webhooks/stripe/route.ts', kind: 'api', auth: 'signature', purpose: 'Paid order intake and refunds. Verified with its own signing secret.' },
  { path: '/api/commerce/webhooks/supplier', file: 'app/api/commerce/webhooks/supplier/route.ts', kind: 'api', auth: 'signature', purpose: 'Supplier status and tracking updates, HMAC-verified.' },
  { path: '/api/commerce/products', file: 'app/api/commerce/products/route.ts', kind: 'api', auth: 'admin', purpose: 'List and create products.' },
  { path: '/api/commerce/products/[id]', file: 'app/api/commerce/products/[id]/route.ts', kind: 'api', auth: 'admin', purpose: 'Read, update (lifecycle and publish rules enforced), delete.' },
  { path: '/api/commerce/research/score', file: 'app/api/commerce/research/score/route.ts', kind: 'api', auth: 'admin', purpose: 'Stateless scoring for the research console.' },
  { path: '/api/commerce/content/generate', file: 'app/api/commerce/content/generate/route.ts', kind: 'api', auth: 'admin', purpose: 'Generates a product content set, saved unapproved.' },
  { path: '/api/commerce/orders/[id]/retry', file: 'app/api/commerce/orders/[id]/retry/route.ts', kind: 'api', auth: 'admin', purpose: 'Re-runs fulfilment. Idempotent.' },
  { path: '/api/commerce/analyst', file: 'app/api/commerce/analyst/route.ts', kind: 'api', auth: 'admin', purpose: 'Grounded question answering over live metrics.' },
  { path: '/api/commerce/automations/run', file: 'app/api/commerce/automations/run/route.ts', kind: 'api', auth: 'admin or cron', purpose: 'Runs the daily or weekly job set.' },
  { path: '/api/commerce/marketing/spend', file: 'app/api/commerce/marketing/spend/route.ts', kind: 'api', auth: 'admin', purpose: 'Manual ad-spend entry, upserted per day.' },
  { path: '/api/commerce/marketing/meta/status', file: 'app/api/commerce/marketing/meta/status/route.ts', kind: 'api', auth: 'admin', purpose: 'Round-trips the Graph API to prove token, account, version and permissions.' },
  { path: '/api/commerce/marketing/meta/import', file: 'app/api/commerce/marketing/meta/import/route.ts', kind: 'api', auth: 'admin or cron', purpose: 'Imports daily insights into ds_ad_metrics.' },
  { path: '/api/commerce/marketing/meta/campaign', file: 'app/api/commerce/marketing/meta/campaign/route.ts', kind: 'api', auth: 'admin', purpose: 'Creates a PAUSED campaign, ad set, creative and ad.' },
  { path: '/api/commerce/marketing/meta/map', file: 'app/api/commerce/marketing/meta/map/route.ts', kind: 'api', auth: 'admin', purpose: 'Attributes an existing campaign to a product.' },
]

export const TABLE_PURPOSE: TableEntry[] = [
  { table: TABLES.products, purpose: 'Catalogue and research record in one row: economics, nine score components, lifecycle, cumulative performance.' },
  { table: TABLES.variants, purpose: 'SKU, options, price, cost, stock.' },
  { table: TABLES.images, purpose: 'Ordered product media with alt text.' },
  { table: TABLES.content, purpose: 'Versioned copy blocks, tagged with the generator that produced them.' },
  { table: TABLES.suppliers, purpose: 'Supplier registry and which adapter drives each one.' },
  { table: TABLES.supplierProducts, purpose: 'Variant to supplier-SKU mapping.' },
  { table: TABLES.customers, purpose: 'Contact details and lifetime totals.' },
  { table: TABLES.orders, purpose: 'Totals, fees, status, attribution, attention reason.' },
  { table: TABLES.orderItems, purpose: 'Line items with a cost snapshot taken at the time of sale.' },
  { table: TABLES.fulfillments, purpose: 'Per-supplier shipment, tracking and status.' },
  { table: TABLES.adMetrics, purpose: 'Daily spend and performance per product, channel and campaign.' },
  { table: TABLES.expenses, purpose: 'Costs that are neither COGS nor advertising.' },
  { table: TABLES.recommendations, purpose: 'Automation output awaiting an operator decision.' },
  { table: TABLES.events, purpose: 'Append-only audit log of every transition, submission and failure.' },
  { table: TABLES.emailLog, purpose: 'Every transactional send, which also enforces the per-order dedupe.' },
  { table: TABLES.abandonedCarts, purpose: 'Checkout starts that did not convert.' },
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
  totals: { modules: number; routes: number; tables: number; products: number; publishedProducts: number }
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
  const publishedProducts = products.filter((p) => p.published).length

  const readiness: ReadinessItem[] = [
    {
      label: 'Database connected',
      ready: config.databaseConfigured,
      blocking: true,
      detail: config.databaseConfigured
        ? 'Persisting to Postgres.'
        : 'Demo mode — seeded in-memory data that resets on restart. Nothing is saved.',
    },
    {
      label: 'Admin allowlist set',
      ready: config.adminEmails.length > 0,
      blocking: true,
      detail:
        config.adminEmails.length > 0
          ? `${config.adminEmails.length} address(es) allowed.`
          : 'COMMERCE_ADMIN_EMAILS is empty, so the admin is closed to everyone.',
    },
    {
      label: 'Payments configured',
      ready: config.stripeConfigured && config.stripeWebhookConfigured,
      blocking: true,
      detail: !config.stripeConfigured
        ? 'STRIPE_SECRET_KEY missing — checkout returns a clear error instead of charging.'
        : !config.stripeWebhookConfigured
          ? 'Checkout works but STRIPE_COMMERCE_WEBHOOK_SECRET is missing, so paid orders would never be recorded.'
          : 'Checkout and webhook both configured.',
    },
    {
      label: 'Transactional email delivers',
      ready: config.emailConfigured,
      blocking: true,
      detail: config.emailConfigured
        ? 'Emails are delivered.'
        : 'Console transport — emails are rendered and logged but never sent. Customers would receive nothing.',
    },
    {
      label: 'A real supplier is connected',
      ready: config.cjConfigured,
      blocking: true,
      detail: config.cjConfigured
        ? 'CJ credentials present. Still place one test order — the adapter is unverified against a live account.'
        : 'Only the mock supplier is available. Fulfilment is simulated.',
    },
    {
      label: 'At least one product published',
      ready: publishedProducts > 0,
      blocking: true,
      detail:
        publishedProducts > 0
          ? `${publishedProducts} product(s) live on the storefront.`
          : 'Nothing is published, so the storefront has nothing to sell.',
    },
    {
      label: 'AI content and analyst',
      ready: config.anthropicConfigured,
      blocking: false,
      detail: config.anthropicConfigured
        ? `Using ${config.aiModel}.`
        : 'Deterministic fallbacks in use, badged in the UI. Usable, just not model-written.',
    },
    {
      label: 'Ad spend imports automatically',
      ready: config.metaConfigured,
      blocking: false,
      detail: capBy('ads')?.note ?? 'Manual entry in /ops/marketing produces real figures either way.',
    },
    {
      label: 'Automations scheduled',
      ready: config.cronConfigured,
      blocking: false,
      detail: config.cronConfigured
        ? 'CRON_SECRET set — any scheduler can trigger the jobs.'
        : 'Jobs can still be run by hand from /ops/automations.',
    },
    {
      label: 'Supplier webhooks verified',
      ready: config.supplierWebhookConfigured,
      blocking: false,
      detail: config.supplierWebhookConfigured
        ? 'Inbound supplier webhooks are HMAC-verified.'
        : 'Endpoint rejects everything until a shared secret is set. The daily poll still updates tracking.',
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
      publishedProducts,
    },
    lastAutomationRun: automationEvents.find((e) => e.kind === 'automation.run') ?? null,
    openRecommendations: recommendations.length,
    recentErrors: errorEvents,
  }
}

/** Test coverage, stated as fact rather than a claim. Kept in step by tests/system.test.ts. */
export const VERIFICATION = [
  { area: 'Money handling', file: 'tests/money.test.ts', covers: 'Currency parsing, payment fees, margins, and never returning NaN or Infinity.' },
  { area: 'Research rubric', file: 'tests/scoring.test.ts', covers: 'Weights summing to 100, derived margin and shipping scores, hard gates, legal lifecycle transitions.' },
  { area: 'AI guardrails', file: 'tests/guardrails.test.ts', covers: 'Detecting invented statistics, medical claims, reviews, scarcity, guarantees; leaving honest copy untouched.' },
  { area: 'Request validation', file: 'tests/validate.test.ts', covers: 'Malformed bodies, cart bounds, email, slugs, HTML escaping.' },
  { area: 'Cart pricing', file: 'tests/cart.test.ts', covers: 'Server-side pricing, duplicate collapsing, stock limits, unpublished products excluded from totals.' },
  { area: 'Profit engine', file: 'tests/profit.test.ts', covers: 'Revenue never reported as profit, refunds, cancelled orders excluded, ROAS and CPA.' },
  { area: 'Order pipeline', file: 'tests/pipeline.test.ts', covers: 'Cost snapshots, idempotent creation, multi-supplier splitting, failure to needs_attention, idempotent retry.' },
  { area: 'Meta transforms', file: 'tests/meta.test.ts', covers: 'Purchase de-duplication, row mapping, campaign markers, attribution precedence, range splitting, error translation.' },
  { area: 'Meta HTTP client', file: 'tests/meta-integration.test.ts', covers: 'Against a mock Graph API: auth header, cursor paging, campaign creation sequence, origin-checked paging links, error paths.' },
  { area: 'System inventory', file: 'tests/system.test.ts', covers: 'Every file path on this page exists, so the manifest cannot silently rot.' },
]
