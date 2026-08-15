// Domain types.
//
// This is a private research and bookkeeping tool, not a shop: there are no
// orders, customers or fulfilments here. Sales arrive as a hand-entered daily
// ledger, and every financial figure is computed from it rather than stored.
//
// Money is always integer minor units (cents). See lib/commerce/money.ts.

export type ProductStatus =
  | 'researching'
  | 'validation'
  | 'approved'
  | 'rejected'
  | 'testing'
  | 'winner'
  | 'loser'
  | 'scaling'

export type AdapterId = 'mock' | 'cj' | 'http'

export interface Supplier {
  id: string
  name: string
  slug: string
  adapter: AdapterId
  config: Record<string, unknown>
  website: string | null
  contact_email: string | null
  default_ship_days_min: number
  default_ship_days_max: number
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

/** The nine rubric components. Each is capped by SCORE_WEIGHTS. */
export interface ScoreComponents {
  demand_score: number
  margin_score: number
  competition_score: number
  problem_score: number
  creative_score: number
  brandability_score: number
  shipping_score: number
  repeat_score: number
  risk_score: number
}

export interface Product extends ScoreComponents {
  id: string
  slug: string
  name: string
  tagline: string | null
  category: string | null
  target_audience: string | null
  problem_solved: string | null

  supplier_id: string | null
  supplier_url: string | null
  product_url: string | null

  cost_cents: number
  shipping_cost_cents: number
  price_cents: number

  ship_days_min: number
  ship_days_max: number

  product_score: number
  research_inputs: Record<string, unknown>

  status: ProductStatus
  /** Where this one is actually sold, so the ledger and the research agree. */
  sell_channel: string | null

  date_discovered: string
  date_tested: string | null
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  alt: string
  position: number
  created_at: string
}

export interface ProductContent {
  id: string
  product_id: string
  version: number
  is_ai: boolean
  generator: 'manual' | 'anthropic' | 'fallback'
  model: string | null
  payload: GeneratedContent
  approved: boolean
  created_at: string
}

/** A product with everything a research view needs, assembled by the repository. */
export interface ProductDetail {
  product: Product
  images: ProductImage[]
  content: GeneratedContent | null
  contentMeta: { generator: string; isAi: boolean; model: string | null } | null
  supplier: Supplier | null
}

/**
 * One day of sales for one product on one channel, typed in by hand.
 *
 * This is the only source of revenue truth. Everything the profit engine
 * reports is computed from these rows plus ad spend and expenses — nothing is
 * cached back onto the product.
 */
export interface SaleEntry {
  id: string
  day: string
  product_id: string | null
  channel: string
  units: number
  revenue_cents: number
  cogs_cents: number
  shipping_cost_cents: number
  fees_cents: number
  refunds_cents: number
  refund_units: number
  note: string | null
  created_at: string
  updated_at: string
}

export type NoteKind = 'note' | 'lesson' | 'idea' | 'source'

/** A playbook entry: something learned, optionally tied to the product that taught it. */
export interface PlaybookNote {
  id: string
  title: string
  body: string
  kind: NoteKind
  tags: string[]
  product_id: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface ChecklistProgress {
  id: string
  product_id: string
  stage: string
  item_key: string
  done: boolean
  note: string | null
  completed_at: string | null
  created_at: string
}

export type PostmortemOutcome = 'winner' | 'loser' | 'undecided'

export interface Postmortem {
  id: string
  product_id: string
  outcome: PostmortemOutcome
  what_happened: string
  what_worked: string
  what_failed: string
  next_time: string
  /** Tagged causes, so patterns across products can be counted rather than felt. */
  factors: string[]
  /** Figures at the moment of writing, so the story cannot drift from the books. */
  snapshot: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SignalSource = 'serpapi_trends' | 'serpapi_shopping' | 'manual'
export type TrendDirection = 'rising' | 'flat' | 'falling' | 'unknown'

/** A signal actually fetched from a provider. The payload is kept so any score can be traced back. */
export interface ResearchSignal {
  id: string
  product_id: string | null
  keyword: string
  source: SignalSource
  payload: Record<string, unknown>
  trend_direction: TrendDirection | null
  trend_score: number | null
  competition_count: number | null
  collected_at: string
}

export interface AdMetric {
  id: string
  product_id: string | null
  channel: string
  campaign_ref: string | null
  day: string
  impressions: number
  clicks: number
  spend_cents: number
  purchases: number
  revenue_cents: number
  source: 'manual' | 'api' | 'import'
  created_at: string
}

export interface Expense {
  id: string
  label: string
  category: string
  amount_cents: number
  day: string
  recurring: boolean
  created_at: string
}

export interface Recommendation {
  id: string
  kind: 'scale' | 'pause' | 'price' | 'creative' | 'restock' | 'investigate'
  severity: 'info' | 'warning' | 'critical'
  product_id: string | null
  title: string
  body: string
  evidence: Record<string, unknown>
  status: 'open' | 'done' | 'dismissed'
  created_at: string
  resolved_at: string | null
}

export interface CommerceEvent {
  id: string
  kind: string
  level: 'info' | 'warn' | 'error'
  message: string
  order_id: string | null
  product_id: string | null
  data: Record<string, unknown>
  created_at: string
}

export interface Setting {
  key: string
  value: unknown
  updated_at: string
}

// --- Cart -----------------------------------------------------------------

// --- AI content -----------------------------------------------------------

export interface GeneratedContent {
  title: string
  subtitle: string
  description: string
  benefits: { heading: string; body: string }[]
  features: string[]
  howItWorks: { step: string; body: string }[]
  specifications: { label: string; value: string }[]
  faq: { question: string; answer: string }[]
  metaTitle: string
  metaDescription: string
  adAngles: string[]
  ugcHooks: string[]
  tiktokHooks: string[]
  metaAdConcepts: { concept: string; primaryText: string; headline: string }[]
  emailAngles: string[]
  imagePrompts: string[]
}
