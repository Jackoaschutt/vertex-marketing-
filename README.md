# Vesper Commerce

An automated dropshipping business in one Next.js 15 app: storefront, product
research engine, supplier abstraction, order pipeline, profit analytics, admin
dashboard, automation engine, Meta Ads integration and an AI analyst.

| Surface | Routes | What it is |
| --- | --- | --- |
| **Storefront** | `/` (and `/store`), `/store/shop`, `/store/product/[slug]`, `/store/cart`, `/store/pages/*` | The public shop. Mobile-first, server-priced, SEO-complete. |
| **Admin** | `/ops` | Overview, products, research, orders, suppliers, customers, analytics, marketing, automations, settings, system. Allowlist-gated. |
| **API** | `/api/commerce/*` | Cart validation, checkout, webhooks, product management, automation runner, Meta Ads. |

Start at **`/ops/system`** — it lists every module, route and table that exists,
whether each is real code, a labelled mock or written-but-unverified, and which
launch-readiness items are still outstanding in the deployment you are looking
at.

There is also `server.py`, a standalone Python MCP server for interactive
product discovery (Google Trends → product ideas → Shopify → Meta Ads). It is
optional and deploys separately.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how it is built and why
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — what is done, partial, mocked and outstanding
- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — run it, deploy it, connect integrations, launch

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

With no environment configured at all, the storefront runs on seeded in-memory
demo data so the whole system can be explored without credentials. The admin at
`/ops` shows a persistent `DEMO DATA` banner whenever that is the case, and
denies access until `COMMERCE_ADMIN_EMAILS` is set.

```bash
npm run typecheck  # tsc --noEmit
npm test           # node --test, 95 tests, no extra dependencies
npm run build      # production build
```

Copy `.env.example` to `.env.local` and fill in what you need — every variable is
documented there, including exactly what breaks without it.
