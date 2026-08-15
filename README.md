# vertex-marketing-

This repository hosts two independent applications that share one Next.js 15
deployment, one Supabase project and one Stripe account.

| App | Routes | What it is |
| --- | --- | --- |
| **PropGuard** | `/`, `/dashboard`, `/session`, `/journal`, `/analytics`, `/accounts`, `/settings`, `/squad` | Prop-firm trading journal with a circuit breaker, analytics and Stripe subscription billing. |
| **Vesper Commerce** | `/store`, `/ops`, `/api/commerce/*` | An automated dropshipping business: storefront, product research engine, supplier abstraction, order pipeline, profit analytics, admin dashboard, automation engine and an AI analyst. |

There is also `server.py`, a standalone Python MCP server for interactive
product discovery (Google Trends → product ideas → Shopify → Meta Ads). It is
optional and deploys separately.

## Commerce documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how it is built and why
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — what is done, partial, mocked and outstanding
- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — run it, deploy it, connect integrations, launch

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000/store
```

With no environment configured at all, the storefront runs on seeded in-memory
demo data so the whole system can be explored without credentials. The admin at
`/ops` shows a persistent `DEMO DATA` banner whenever that is the case, and
denies access until `COMMERCE_ADMIN_EMAILS` is set.

```bash
npm run typecheck  # tsc --noEmit
npm test           # node --test, 55 tests, no extra dependencies
npm run build      # production build
```

Copy `.env.example` to `.env.local` and fill in what you need — every variable is
documented there, including exactly what breaks without it.
