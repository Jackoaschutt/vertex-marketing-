# Roadmap — Vesper Commerce

Status per item: **DONE** (built and working in this repo) · **PARTIAL** (usable, gap noted) · **TODO** (interface exists, implementation pending) · **BLOCKED** (needs credentials or an external account).

---

## PHASE 1 — Foundation · DONE

| Item | Status | Notes |
| --- | --- | --- |
| Repository + stack audit | DONE | `docs/ARCHITECTURE.md` §1 |
| Architecture + roadmap docs | DONE | This file and ARCHITECTURE.md |
| Namespace decision (coexist with PropGuard) | DONE | `/store`, `/ops`, `/api/commerce`, `ds_*` tables |
| Domain types | DONE | `lib/commerce/types.ts` |
| Money handling (integer minor units) | DONE | `lib/commerce/money.ts` |
| Brand configuration | DONE | `lib/commerce/brand.ts` — single source of truth for name, voice, palette, policies |
| Runtime config + capability detection | DONE | `lib/commerce/config.ts` reports which integrations are live |
| Database schema | DONE | `supabase/migrations/011_commerce_core.sql`, 17 tables, RLS on all |
| Driver-swappable data layer | DONE | `lib/commerce/db/` — Supabase driver + seeded memory driver |
| Input validation | DONE | `lib/commerce/validate.ts` |
| Admin auth gate | DONE | `lib/commerce/auth.ts` + middleware update |
| `.env.example` | DONE | Every variable documented with its effect |
| Test harness | DONE | `npm run test` — `node --test`, no new dependencies |

## PHASE 2 — Store · DONE

| Item | Status | Notes |
| --- | --- | --- |
| Design system (typography, colour, spacing) | DONE | Tailwind `ink`/`sand`/`clay` scales, `.commerce-scope` |
| Home | DONE | Hero, positioning, category rail, featured products, proof, editorial |
| Shop / collection | DONE | Filter + sort, empty states |
| Product detail | DONE | Gallery, variants, qty, benefits, how-it-works, specs, shipping, returns, FAQ, related |
| Cart | DONE | Client cart, server price re-validation, empty state |
| Checkout | DONE | Stripe Checkout Session — **BLOCKED on `STRIPE_SECRET_KEY`** for a live charge; returns a clear, actionable error without it |
| About / FAQ / Contact | DONE | Contact form posts to `/api/commerce/contact` |
| Shipping / Returns / Privacy / Terms | DONE | Neutral placeholder policies generated from `brand.ts` — **operator must supply real legal entity details before launch** |
| Mobile-first pass | DONE | 375 px baseline, sticky buy bar, thumb-reachable controls |
| SEO metadata + JSON-LD + sitemap + robots | DONE | `lib/commerce/seo.ts` |

## PHASE 3 — Product Research · DONE

| Item | Status | Notes |
| --- | --- | --- |
| 100-point scoring rubric | DONE | `lib/commerce/research/scoring.ts` — Demand 20, Margin 15, Competition 15, Problem 15, Creative 10, Brandability 10, Shipping 5, Repeat 5, Risk 5 |
| Deterministic margin/shipping sub-scores from real numbers | DONE | Computed from cost/price/ship-time, not guessed |
| Lifecycle statuses | DONE | `researching → validation → approved/rejected → testing → winner/loser → scaling` with legal-transition enforcement |
| Research console | DONE | `/ops/research` — candidate entry, live score breakdown, status transitions |
| Candidate → catalogue promotion | DONE | Approving a candidate creates the product + default variant |
| Automated demand/competition signals | TODO | Needs `SERPAPI_KEY` or equivalent. `server.py` already integrates SerpAPI — bridge documented in RUNBOOK |

## PHASE 4 — Supplier Automation · PARTIAL

| Item | Status | Notes |
| --- | --- | --- |
| `SupplierAdapter` abstraction | DONE | `lib/commerce/suppliers/types.ts` |
| Adapter registry, per-supplier resolution | DONE | Swap supplier = DB row change |
| Mock adapter | DONE (**MOCK**) | Deterministic catalogue + simulated fulfilment; every response tagged `__mock` |
| Generic HTTP adapter | DONE | Config-driven; works with any JSON supplier API |
| CJdropshipping adapter | PARTIAL (**REAL, UNVERIFIED**) | Written to CJ's published API v2 shapes; never executed against a live account. Verify before production |
| Inventory + price drift detection | DONE | Daily automation job |
| Supplier webhook receiver | DONE | HMAC-verified, updates fulfilment + tracking |
| AliExpress / Zendrop / Spocket adapters | TODO | Use the generic HTTP adapter or add a module — no core changes needed |

## PHASE 5 — Order Automation · DONE

| Item | Status | Notes |
| --- | --- | --- |
| Stripe Checkout → order creation | DONE | Signature-verified webhook, idempotent on `session.id` |
| Server-side price re-validation | DONE | Client cart carries no prices |
| Order state machine | DONE | `lib/commerce/orders/pipeline.ts` |
| Multi-supplier order splitting | DONE | Items grouped by supplier, one supplier order per group |
| Failure handling | DONE | `needs_attention` + reason + event log + admin notification. Never silent |
| Manual retry | DONE | `/ops/orders` → Retry; idempotent |
| Tracking ingestion + customer notification | DONE | Via supplier webhook or the daily poll job |
| Refunds | PARTIAL | Recorded and reflected in profit; issuing a refund through Stripe from `/ops` is TODO |

## PHASE 6 — Analytics · DONE

| Item | Status | Notes |
| --- | --- | --- |
| Profit engine | DONE | `lib/commerce/analytics/profit.ts`, integer money throughout |
| Revenue vs gross vs net separation | DONE | Never conflated in code or UI |
| AOV, CR, CPA, ROAS, refund rate | DONE | Metrics show "insufficient data" rather than 0 or NaN |
| Per-product P&L | DONE | Contribution margin per product |
| Ops overview dashboard | DONE | Today/week/month, best & worst product, charts |
| Attribution | DONE | UTM + click-id capture → cookie → order |
| System inventory page | DONE | `/ops/system` — every module, route and table with its REAL/MOCK/UNVERIFIED status, live readiness checks and test coverage. `tests/system.test.ts` asserts every path it names exists, so it cannot rot into a false claim |
| Conversion-funnel drop-off | PARTIAL | Order-side funnel is real; page-view funnel needs an analytics provider (TODO) |

## PHASE 7 — Marketing Automation · PARTIAL

| Item | Status | Notes |
| --- | --- | --- |
| Ad metric schema + storage | DONE | `ds_ad_metrics`, daily per product per channel |
| Manual ad-spend entry | DONE | `/ops/marketing` |
| `AdChannelClient` interface + mock | DONE (**MOCK**) | |
| **Meta Ads client** | DONE (**REAL, unverified against a live account**) | `lib/commerce/marketing/adapter-meta.ts`. Daily insights import, campaign creation (always PAUSED), interest resolution, account verification. Ported from `server.py` stage 4 with its gaps closed |
| Meta → product attribution | DONE | Explicit campaign map plus a `[vsp:<slug>]` campaign-name marker; unattributed spend is reported, never silently dropped |
| Meta import in the daily job | DONE | Runs before the ROAS check so recommendations use fresh spend; a failed import raises a critical recommendation rather than passing silently |
| TikTok / Google clients | TODO | **BLOCKED** on tokens and ad-account IDs. Implement `AdChannelClient`; nothing else changes |
| Email transport interface | DONE | Console (MOCK) + Resend (REAL) |
| 9 lifecycle email templates | DONE | Rendered HTML + text, dedupe-guarded |
| Abandoned-cart capture | DONE | Checkout starts recorded; recovery email fires from the daily job |
| SMS | TODO | Interface shape mirrors email; no provider wired |

## PHASE 8 — AI Optimization · DONE

| Item | Status | Notes |
| --- | --- | --- |
| AI content pipeline | DONE | Title, description, benefits, features, FAQ, meta, ad angles, UGC/TikTok hooks, Meta concepts, email angles |
| Truthfulness guardrails | DONE | Prohibition list in prompt + `ai/guardrails.ts` post-scan rejecting fabricated-claim patterns |
| Deterministic fallback without an API key | DONE | Tagged `generator: 'fallback'`, badged in UI |
| Grounded AI business analyst | DONE | Metrics computed from the DB first, model answers only from that bundle |
| Rules-based analyst fallback | DONE | Real answers without an API key |
| Daily + weekly automation jobs | DONE | `lib/commerce/automation/jobs.ts` |
| Recommendation engine | DONE | Winners, losers, pause, scale, price, creative |
| Auto-applying recommendations | Deliberately NOT built | Operator approves. Automating price/status changes against live money without a human is the wrong default |

---

## What must happen before taking real money

1. Create a Supabase project, run every migration including `011_commerce_core.sql`.
2. Set `COMMERCE_ADMIN_EMAILS` — until then `/ops` denies everyone.
3. Set Stripe live keys and register the commerce webhook endpoint separately from PropGuard's.
4. Replace the placeholder policy pages with real legal text and a real business entity, address, and contact.
5. Connect a real supplier (CJ adapter verified, or the generic HTTP adapter configured) and place one live test order end to end.
6. Set `RESEND_API_KEY` (or another transport) so customers actually receive email.
7. Verify the demo-data banner is gone from `/ops` — its presence means the database is not connected.
