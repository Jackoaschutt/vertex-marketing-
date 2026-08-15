# Architecture — Vesper Commerce

> **Status legend used throughout this repo**
> `REAL` — fully implemented and functional.
> `MOCK` — deliberate stand-in with a real interface behind it; clearly labelled in code.
> `TODO` — interface exists, implementation not written.

---

## 1. What already existed (repository audit, before this work)

The audit was run before any code was written. Findings:

| Area | Finding |
| --- | --- |
| Framework | Next.js `15.5.18`, App Router, React 19, TypeScript strict |
| Package manager | npm (`package-lock.json` present, no pnpm/yarn lockfiles) |
| Styling | Tailwind CSS v3 + PostCSS/autoprefixer, custom `brand`/`danger`/`warning` palettes |
| Existing app | **PropGuard** — a prop-firm trading journal owning `/`, `/dashboard`, `/session`, `/journal`, `/analytics`, `/accounts`, `/settings`, `/squad`, `/login`, `/signup`, `/onboarding`, `/paywall`. *(Since removed — see "Removing PropGuard" below.)* |
| Database | Supabase Postgres. 10 migrations in `supabase/migrations/` (`001`–`010` + one combined squad-hub file), all belonging to the trading journal |
| Payments | Stripe `^17.7.0`, already wired |
| Auth | Supabase Auth (email/password) via `@supabase/ssr`; `middleware.ts` guards every non-public route |
| AI | `@anthropic-ai/sdk ^0.98.0` already a dependency |
| Charts | `recharts ^3.8.1` |
| Existing automation | `server.py` — a **DropshipDiscovery MCP server** (Python/FastMCP/Starlette). Real HTTP integrations, each env-gated with a "preview mode" fallback: SerpAPI (Google Trends), Anthropic (idea generation + scoring + copy), Shopify Admin REST, Meta Marketing API |
| Shopify config | None in the Next.js app. `server.py` reads `SHOPIFY_STORE` / `SHOPIFY_ADMIN_TOKEN` |
| Deployment | Vercel-shaped (`.vercel` in `.gitignore`, no `vercel.json`). `requirements.txt` for the Python MCP server |
| Env vars | `.env.example` covered Supabase, Stripe, app URL, credential encryption key. No commerce vars |

### Key architectural decision arising from the audit

Development rule #1 is *"do not destroy working functionality"*. PropGuard was working functionality and it occupied `/` and `/dashboard`. So the commerce system was built as a **self-contained module in its own namespace inside the same Next.js app**, sharing only the infrastructure primitives (Supabase client, Stripe client, Tailwind config, Anthropic SDK):

| Concern | Namespace |
| --- | --- |
| Storefront | `/store`, `/store/shop`, `/store/product/[slug]`, `/store/cart`, `/store/pages/*` |
| Admin | `/ops` (Overview, Products, Research, Orders, Suppliers, Customers, Analytics, Marketing, Automations, Settings, System) |
| HTTP API | `/api/commerce/*` |
| Domain code | `lib/commerce/*` |
| UI | `components/store/*`, `components/ops/*` |
| Database | `ds_*` tables, migration `011_commerce_core.sql` |

**The store is the site's front door.** `middleware.ts` rewrites `/` → `/store`, so the home page keeps the bare root URL.

### Removing PropGuard

PropGuard has since been removed at the owner's request. The namespacing above is why that was a clean deletion rather than an untangling: commerce never imported PropGuard code, so removing `app/(dashboard)/`, PropGuard's API routes, `lib/analytics/`, `lib/circuit-breaker/`, `lib/crypto.ts`, `lib/squadCode.ts`, the browser extension and migrations `001`–`010` touched nothing the store depends on.

Three things were deliberately **kept**, because commerce needs them:

| Kept | Why |
| --- | --- |
| `app/(auth)/login`, `app/(auth)/signup` | The admin allowlist authorises a Supabase session; there has to be a way to obtain one. |
| `lib/supabase/*` | Both the auth gate and the storage driver use it. |
| `lib/stripe.ts` | The commerce checkout and webhook use the shared client. |

PropGuard's database tables are untouched by the deletion — dropping them is a separate decision, and no commerce code reads them.

---

## 2. System overview

```
                    ┌──────────────────────────────────────────┐
   TikTok / Meta ──▶ │  STOREFRONT  /store          (RSC, SSR)  │
   Google / Direct   │  home · shop · product · cart · policies │
                    └───────────────┬──────────────────────────┘
                                    │ POST /api/commerce/checkout
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │  CHECKOUT      Stripe Checkout Session    │  REAL (needs keys)
                    │  server-side price re-validation          │
                    └───────────────┬──────────────────────────┘
                                    │ webhook (signature verified)
                                    ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │  ORDER PIPELINE   lib/commerce/orders/pipeline.ts                     │
   │  received → validated → routed → submitted → fulfilled → delivered    │
   │            ↘ needs_attention (never silently fails)                   │
   └──────┬────────────────────────────────┬───────────────────────────────┘
          │                                │
          ▼                                ▼
   ┌──────────────┐               ┌────────────────────┐
   │ SupplierAdapter (iface)      │ EmailTransport (iface)
   │  mock  │ cj  │ generic-http  │  console │ resend   │
   └──────┬───────┘               └────────────────────┘
          │
          ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │  DATA LAYER   lib/commerce/db  —  driver-swappable                    │
   │  SupabaseDriver (service role, RLS-bypassing, server-only)            │
   │  MemoryDriver   (seeded demo data, used when Supabase env is absent)  │
   └──────┬────────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  ADMIN /ops    profit engine · research scoring · automations · AI    │
   └──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend

**Rendering.** Server Components by default. Client Components only where interactivity is unavoidable: cart drawer, variant picker, quantity stepper, ops charts, ops forms, AI analyst chat.

**Data flow.** Storefront pages read through `lib/commerce/db` repositories directly in the RSC render — no internal `fetch` to our own API. The `/api/commerce/*` routes exist for browser-initiated mutations (cart validation, checkout, ops CRUD) and for third-party webhooks.

**Cart.** Client-side, persisted in `localStorage` under `vesper.cart.v1`. It holds only `{variantId, qty}` — never prices. Every price is re-derived server-side at checkout, so a tampered cart cannot change what the customer is charged.

**Styling.** Tailwind, with the commerce design system in `tailwind.config.ts` under the `ink` / `sand` / `clay` scales. The type scale is set in `app/globals.css` behind `.commerce-scope`, which is also what keeps the storefront light against the dark global `body` inherited from the original app.

**Mobile-first.** Every storefront layout is authored at 375 px and progressively enhanced. Product pages carry a sticky add-to-cart bar below `md`. Images use `next/image` with explicit `sizes`, `priority` only on the LCP hero.

---

## 4. Backend

Next.js Route Handlers under `app/api/commerce/`:

| Route | Method | Auth | Status |
| --- | --- | --- | --- |
| `/api/commerce/cart/validate` | POST | public | REAL |
| `/api/commerce/checkout` | POST | public, rate-limited | REAL (Stripe keys required) |
| `/api/commerce/webhooks/stripe` | POST | Stripe signature | REAL (keys required) |
| `/api/commerce/webhooks/supplier` | POST | HMAC shared secret | REAL |
| `/api/commerce/products` | GET/POST | admin | REAL |
| `/api/commerce/products/[id]` | GET/PATCH/DELETE | admin | REAL |
| `/api/commerce/research/score` | POST | admin | REAL |
| `/api/commerce/content/generate` | POST | admin | REAL w/ Anthropic key, deterministic fallback otherwise |
| `/api/commerce/orders` | GET | admin | REAL |
| `/api/commerce/orders/[id]/retry` | POST | admin | REAL |
| `/api/commerce/analytics/summary` | GET | admin | REAL |
| `/api/commerce/analyst` | POST | admin | REAL w/ Anthropic key |
| `/api/commerce/automations/run` | POST | admin **or** `CRON_SECRET` | REAL |
| `/api/commerce/marketing/spend` | POST | admin | REAL |
| `/api/commerce/marketing/meta/status` | GET | admin | REAL (round-trips the Graph API) |
| `/api/commerce/marketing/meta/import` | POST | admin **or** `CRON_SECRET` | REAL |
| `/api/commerce/marketing/meta/campaign` | POST | admin | REAL |
| `/api/commerce/marketing/meta/map` | POST | admin | REAL |
| `/api/commerce/contact` | POST | public, rate-limited | REAL |

`/api/commerce/webhooks/stripe` uses its own `STRIPE_COMMERCE_WEBHOOK_SECRET` and ignores any event without `metadata.commerce === 'vesper'`, so another webhook on the same Stripe account cannot be mistaken for an order.

---

## 5. Database

Migration `supabase/migrations/011_commerce_core.sql`. Every table is prefixed `ds_` and carries RLS enabled with **no public policies** — all access is server-side through the service-role key. Storefront reads go through the server too, so no anon-key surface is exposed.

| Table | Purpose |
| --- | --- |
| `ds_suppliers` | Supplier registry + which adapter drives it |
| `ds_products` | Catalogue **and** research record: costs, the nine score components, lifecycle status, cumulative performance |
| `ds_product_variants` | SKU, options, price, cost, stock |
| `ds_product_images` | Ordered media with alt text |
| `ds_product_content` | Versioned AI/human copy blocks (`generator`, `model`, `is_ai`) |
| `ds_supplier_products` | Variant → supplier SKU mapping (many suppliers per variant) |
| `ds_customers` | Contact + lifetime aggregates |
| `ds_orders` | Totals, fees, status, attribution, `attention_reason` |
| `ds_order_items` | Line items with cost snapshot at time of sale |
| `ds_fulfillments` | Per-supplier shipment, tracking, carrier, status |
| `ds_ad_metrics` | Daily per-product per-channel spend/impressions/clicks/purchases |
| `ds_expenses` | Non-COGS, non-ad costs |
| `ds_recommendations` | Automation output the operator can act on |
| `ds_events` | Append-only audit/automation log |
| `ds_email_log` | Every transactional send (dedupe + audit) |
| `ds_abandoned_carts` | Checkout starts that never converted |
| `ds_settings` | Key/value operator settings |

**Money is stored in integer minor units** (cents) everywhere. No floats touch money.

### Demo driver

If `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are absent, `lib/commerce/db` transparently falls back to an in-process `MemoryDriver` seeded from `lib/commerce/db/seed.ts`. This makes the whole system runnable and testable with zero credentials. **It is process-local and resets on restart** — the ops dashboard renders a persistent `DEMO DATA` banner whenever it is active, so it can never be mistaken for production.

---

## 6. Supplier integration

`lib/commerce/suppliers/types.ts` defines the abstraction. Nothing above it may import a supplier-specific module.

```ts
interface SupplierAdapter {
  readonly id: string
  readonly status: 'REAL' | 'MOCK'
  getProducts(q?): Promise<SupplierProduct[]>
  getProduct(id): Promise<SupplierProduct | null>
  getInventory(sku): Promise<InventoryLevel>
  getPrice(sku): Promise<SupplierPrice>
  createOrder(req): Promise<SupplierOrderRef>
  getOrderStatus(ref): Promise<SupplierOrderStatus>
  getTracking(ref): Promise<TrackingInfo | null>
}
```

| Adapter | Status | Notes |
| --- | --- | --- |
| `mock` | **MOCK** | Deterministic catalogue + simulated fulfilment. Default when no supplier credentials exist. Every response carries `__mock: true` |
| `cj` (CJdropshipping) | **REAL, UNVERIFIED** | Written against CJ's published API v2 shapes. Throws `SupplierNotConfiguredError` without `CJ_EMAIL` + `CJ_API_KEY`. Has **not** been run against a live CJ account — verify field names before switching production traffic to it |
| `http` | **REAL** | Generic adapter for any supplier exposing a JSON API, driven by a URL/field-map config. Use this rather than forking the codebase per supplier |

Adapters are resolved per-supplier-row at runtime by `lib/commerce/suppliers/registry.ts`. Swapping a supplier is a database update, not a code change.

---

## 7. Order automation

`lib/commerce/orders/pipeline.ts` is a single state machine, invoked from the Stripe webhook and re-invokable from `/ops/orders`:

```
paid ─▶ validate ─▶ group items by supplier ─▶ adapter.createOrder per group
                                                   │
                     ┌─────────────────────────────┴──────────────┐
                  success                                      failure
                     │                                            │
              record fulfillment                    order.status = needs_attention
              email: order confirmed                attention_reason = <message>
                     │                              ds_events: error entry
              poll adapter.getTracking              admin notification queued
                     │                              → NEVER silently swallowed
              email: shipped → delivered
```

Every transition writes to `ds_events`. Retries are idempotent: an order already holding a fulfilment for a supplier group is never re-submitted.

---

## 8. Analytics & profit engine

`lib/commerce/analytics/profit.ts`. Revenue is never conflated with profit:

```
gross revenue      = Σ order.subtotal
net revenue        = gross − discounts − refunds
COGS               = Σ item.unit_cost × qty
gross profit       = net revenue − COGS − inbound shipping
payment fees       = Σ order.payment_fee   (2.9% + 30¢ default, configurable)
net profit         = gross profit − payment fees − ad spend − other expenses
```

Derived: AOV, conversion rate, CPA, ROAS, refund rate, contribution margin per product.

Ad spend enters via `ds_ad_metrics`. Until a Meta/TikTok/Google token exists, those rows are populated manually in `/ops/marketing` or by an importer — the dashboard labels ad-derived figures as such and shows a "no ad data" state rather than inventing numbers.

---

## 9. AI

Single client wrapper: `lib/commerce/ai/client.ts` using `@anthropic-ai/sdk`, model `claude-opus-5`, adaptive thinking, and JSON-schema structured output.

| Feature | Behaviour without `ANTHROPIC_API_KEY` |
| --- | --- |
| Product content pipeline (`ai/content.ts`) | Deterministic template generator, response tagged `generator: 'fallback'`, UI shows a `FALLBACK` badge |
| AI business analyst (`ai/analyst.ts`) | Returns a rules-based answer computed from real metrics, tagged the same way |

The analyst is **grounded**: it never queries the model for facts. `analyst.ts` computes the metric bundle from the database first, passes it as context, and instructs the model to answer only from that bundle. Copy generation is constrained by an explicit prohibition list (no invented certifications, medical claims, reviews, customer results, statistics, or guarantees) that is enforced twice — in the prompt and by a post-generation `lib/commerce/ai/guardrails.ts` scan that rejects output containing fabricated-claim patterns.

---

## 10. Automation engine

`lib/commerce/automation/jobs.ts` — pure functions, no scheduler coupling.

**Daily:** supplier inventory drift · supplier price drift · low stock · orders stuck in `needs_attention` · orders with no tracking after N days · per-product performance snapshot · recommendation generation.

**Weekly:** classify winners/losers · pause candidates (ROAS below target over a rolling window) · scale candidates · pricing-change suggestions · new creative-angle suggestions for fatigued products.

Triggered by `POST /api/commerce/automations/run` with either an admin session or an `Authorization: Bearer $CRON_SECRET` header, so any scheduler works (Vercel Cron, GitHub Actions, external). Output lands in `ds_recommendations` and `ds_events`; nothing is auto-applied to live products without an operator action.

---

## 11. Marketing & attribution

`ds_orders.attribution` captures `{source, medium, campaign, content, term, click_id}` from UTM params + `fbclid`/`ttclid`/`gclid`, persisted to a first-party cookie on landing and attached at checkout. `lib/commerce/analytics/attribution.ts` rolls orders up by source.

### Ad channels

`lib/commerce/marketing/channels.ts` defines `AdChannelClient`. Implementations:

| Channel | Status | Notes |
| --- | --- | --- |
| `manual` | REAL | Operator enters spend in `/ops/marketing`. Produces genuine ROAS/CPA |
| `meta` | **REAL** | `adapter-meta.ts` — daily insights import and campaign creation |
| `mock` | MOCK | Deterministic numbers for development |
| `tiktok`, `google` | TODO | Implement the interface; nothing else changes |

**Meta client** (`lib/commerce/marketing/adapter-meta.ts`). Ported from the Meta stage of `server.py`, with each of that implementation's gaps closed:

| `server.py` | Here |
| --- | --- |
| `page_id: "YOUR_PAGE_ID"` placeholder | `META_PAGE_ID`, required and checked |
| Interests sent by **name** (Meta ignores them → campaign silently runs fully broad) | Resolved to real targeting IDs via `/search?type=adinterest`; unresolvable names are reported, not sent |
| `.json().get("id")` — a failed create returns `None` and looks like success | Every response checked; Meta's own error message surfaced with an actionable hint |
| API version hard-coded `v19.0` | `META_API_VERSION`, and an expired-version error is detected and explained |
| Creates campaigns only | Also **reads** performance, which is what the profit engine needs |
| No attribution back to a product | Campaign→product mapping, so spend lands on the right P&L row |

**Attribution.** Meta has no idea what our product ids are. Two mechanisms, in precedence order: an explicit `campaignId → productId` map in `ds_settings.meta_campaign_map` (written automatically when a campaign is launched from `/ops`), then a `[vsp:<product-slug>]` marker in the campaign name so a hand-made campaign can still be attributed. Anything matching neither is imported with `product_id = null` — it still counts toward total ad spend and account-level net profit, but cannot be charged to one product. Unattributed campaigns are reported back on every import and raise a recommendation, so the money is never quietly unaccounted for.

**Double-counting defence.** Meta reports the same conversion under `omni_purchase`, `purchase` and `offsite_conversion.fb_pixel_purchase`. Summing them triples reported purchases and makes ROAS look excellent. `extractAction` reads the *first* type present in preference order and never sums — this is unit-tested, because it is the single most dangerous transform in the integration.

**Money.** Meta returns `spend` and `action_values` as decimal strings in the ad account's currency, converted to integer cents on the way in. Currency is **not** converted — `verifyAccess()` reports the account currency and the UI flags a mismatch with `COMMERCE_CURRENCY` rather than silently corrupting ROAS.

**Safety.** Campaigns are created `PAUSED` at every level (campaign, ad set, ad) and the system never activates them. A product that is not published and sellable cannot be advertised, so paid traffic is never sent to a page that is not for sale.

---

## 12. Email automation

`lib/commerce/email/` — `EmailTransport` interface with:
- `ConsoleTransport` (**MOCK**, default — logs the full rendered email and records to `ds_email_log`)
- `ResendTransport` (**REAL**, activates with `RESEND_API_KEY`)

Nine templates: welcome, abandoned cart, order confirmation, shipped, delivered, post-purchase check-in, review request, win-back, support acknowledgement. Every send is deduplicated by `(order_id, template)` in `ds_email_log`, so a webhook replay cannot spam a customer.

---

## 13. SEO

Per-route `generateMetadata` with canonical URLs, Open Graph and Twitter cards. JSON-LD in `lib/commerce/seo.ts`: `Organization` + `WebSite` on the storefront root, `Product` + `Offer` on product pages (`AggregateRating` only emitted when real review rows exist — never fabricated), `BreadcrumbList`, `FAQPage` on the FAQ. `app/store-sitemap.xml/route.ts` and `app/robots.txt/route.ts` are generated from live data. Slugs are clean and stable; a slug change writes a redirect row rather than 404ing.

---

## 14. Performance

Server Components keep the storefront JS budget small — the only client bundles are the cart, the variant picker and the sticky buy bar. `next/image` with AVIF/WebP and explicit `sizes`. Product listing queries select only projection columns. Catalogue reads are wrapped in `unstable_cache` with tag-based invalidation on product write. No UI component library was added; `recharts` (already present) is used for ops charts only and never ships to the storefront.

---

## 15. Security

- Service-role key is imported only from `lib/commerce/db/driver-supabase.ts`, which is `import 'server-only'`.
- RLS enabled on every `ds_` table with no permissive policies.
- Admin authorisation is a two-gate check: Supabase session (middleware) **plus** `lib/commerce/auth.ts#requireAdmin()` matching the session email against `COMMERCE_ADMIN_EMAILS`. An empty allowlist denies everyone rather than allowing everyone.
- Stripe webhook signatures verified with `constructEvent` against the raw body.
- Supplier webhooks verified with a timing-safe HMAC comparison.
- All request bodies pass through hand-rolled validators in `lib/commerce/validate.ts` (no new dependency) before touching the database.
- In-memory sliding-window rate limits on checkout and the analyst endpoint.
- No secret is referenced under `NEXT_PUBLIC_` except the Supabase anon key and the site URL.

---

## 16. Deployment

Vercel is the target. `npm run build` → static/RSC output; route handlers become serverless functions. Required env vars are documented in `.env.example` and in `docs/RUNBOOK.md`. `server.py` (the MCP discovery server) deploys separately (Railway/Fly/any Python host) and is optional — the Next.js research engine does not depend on it.

---

## 17. Relationship to `server.py`

`server.py` remains untouched and is complementary: it is an **MCP tool surface** for interactive discovery (trends → ideas → Shopify → Meta). The Next.js research engine in `lib/commerce/research/` is the **system of record** — it stores candidates, applies the 100-point rubric deterministically, and tracks lifecycle. The intended flow is: discover in `server.py` (or manually) → import the candidate into `ds_products` via `/ops/research` → score → validate → approve → publish.

They are not wired together automatically, because doing so would require the MCP server's URL and credentials that this repository does not have. `docs/RUNBOOK.md` documents the manual bridge.
