// Domain types for Vesper Commerce.
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

export type OrderStatus =
  | 'received'
  | 'validated'
  | 'routed'
  | 'submitted'
  | 'fulfilled'
  | 'delivered'
  | 'needs_attention'
  | 'cancelled'
  | 'refunded'

export type FulfillmentStatus =
  | 'pending'
  | 'submitted'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'failed'
  | 'cancelled'

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
  compare_at_cents: number | null

  ship_days_min: number
  ship_days_max: number

  product_score: number
  research_inputs: Record<string, unknown>

  status: ProductStatus
  published: boolean
  featured: boolean
  position: number

  ad_spend_cents: number
  revenue_cents: number
  orders_count: number
  sessions_count: number
  refunds_cents: number
  refunds_count: number

  meta_title: string | null
  meta_description: string | null

  date_discovered: string
  date_tested: string | null
  created_at: string
  updated_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  title: string
  options: Record<string, string>
  price_cents: number
  cost_cents: number
  stock: number | null
  is_default: boolean
  position: number
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

export interface SupplierProductLink {
  id: string
  supplier_id: string
  variant_id: string
  supplier_sku: string
  supplier_cost_cents: number
  supplier_ship_cents: number
  lead_days: number
  is_primary: boolean
  last_synced_at: string | null
  created_at: string
}

/** A product with everything the storefront needs, assembled by the repository. */
export interface ProductDetail {
  product: Product
  variants: ProductVariant[]
  images: ProductImage[]
  content: GeneratedContent | null
  contentMeta: { generator: string; isAi: boolean; model: string | null } | null
  supplier: Supplier | null
}

export interface Customer {
  id: string
  email: string
  name: string | null
  phone: string | null
  marketing_opt_in: boolean
  orders_count: number
  spend_cents: number
  first_order_at: string | null
  last_order_at: string | null
  created_at: string
  updated_at: string
}

export interface Address {
  name?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export interface Attribution {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  click_id?: string
  landing_page?: string
}

export interface Order {
  id: string
  order_number: string
  customer_id: string | null
  email: string
  currency: string

  subtotal_cents: number
  shipping_cents: number
  tax_cents: number
  discount_cents: number
  total_cents: number
  payment_fee_cents: number
  cogs_cents: number
  refund_cents: number

  status: OrderStatus
  attention_reason: string | null

  shipping_address: Address
  attribution: Attribution

  stripe_session_id: string | null
  stripe_payment_intent_id: string | null

  placed_at: string
  fulfilled_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  variant_id: string | null
  supplier_id: string | null
  sku: string
  title: string
  quantity: number
  unit_price_cents: number
  unit_cost_cents: number
  created_at: string
}

export interface Fulfillment {
  id: string
  order_id: string
  supplier_id: string | null
  supplier_ref: string | null
  status: FulfillmentStatus
  tracking_number: string | null
  tracking_url: string | null
  carrier: string | null
  cost_cents: number
  error_message: string | null
  submitted_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
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

export interface EmailLogEntry {
  id: string
  template: string
  to_email: string
  subject: string
  order_id: string | null
  transport: string
  status: 'sent' | 'failed' | 'skipped'
  error: string | null
  created_at: string
}

export interface AbandonedCart {
  id: string
  email: string | null
  items: CartLine[]
  value_cents: number
  recovered: boolean
  reminded_at: string | null
  attribution: Attribution
  created_at: string
}

export interface Setting {
  key: string
  value: unknown
  updated_at: string
}

// --- Cart -----------------------------------------------------------------

/** What the browser stores. Deliberately carries no prices. */
export interface CartLine {
  variantId: string
  qty: number
}

/** What the server returns after re-pricing a cart. */
export interface PricedCartLine {
  variantId: string
  productId: string
  slug: string
  title: string
  variantTitle: string
  image: string | null
  qty: number
  unitPriceCents: number
  lineTotalCents: number
  available: boolean
  reason?: string
}

export interface PricedCart {
  lines: PricedCartLine[]
  subtotalCents: number
  shippingCents: number
  totalCents: number
  currency: string
  hasUnavailable: boolean
}

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
