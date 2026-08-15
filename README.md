# Ecom cockpit

A private tool for one person running an ecommerce business: find products worth
testing, keep the books for whatever you sell elsewhere, and build the judgement
to do it better next time.

It is **not** a shop. There is no storefront, no checkout, and no public page —
every path requires a passcode.

| Surface | What it is |
| --- | --- |
| **Books** (`/ops/books`) | The ledger. Enter a day of sales; every financial figure in the tool is computed from it. |
| **Research** (`/ops/research`) | The 100-point rubric, with demand and competition collected from real data when SerpAPI is connected. |
| **Products** (`/ops/products`) | Every candidate, its score, its stage progress, and what it actually earned. |
| **Playbook** (`/ops/playbook`) | What you have worked out, in your own words. |
| **Post-mortems** (`/ops/postmortems`) | Why each finished product won or died, plus the pattern across all of them. |
| **Analytics** (`/ops/analytics`) | Per-product contribution, revenue by channel, where the overheads went. |
| **Marketing** (`/ops/marketing`) | Ad spend, Meta import, blended and per-product return. |
| **System** (`/ops/system`) | Everything that exists and whether it is real, mocked or unverified. |

## The three things it refuses to do

1. **Report revenue as profit.** They are separate fields the whole way through.
2. **Invent a number.** A rate with no denominator is `—`, not zero. A missing
   trend is an error, not a plausible-looking line.
3. **Store a total twice.** Every figure is computed from the ledger at request
   time, so correcting one day corrects the entire history immediately.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000 → /unlock
```

With no environment configured, it runs on seeded in-memory data so the whole
tool can be explored. `/ops` shows a permanent `DEMO DATA` banner whenever that
is the case, so it can never be mistaken for your real books.

```bash
npm run typecheck  # tsc --noEmit
npm test           # node --test, 84 tests, no extra dependencies
npm run build      # production build
```

## The only credential

```
ADMIN_PASSCODE=something-long-you-will-remember
```

One passcode, hashed into a session cookie. An unset passcode denies everyone —
the failure mode of a misconfigured deployment must never be an open door onto
your financials.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how it is built and why
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — what is done, partial and outstanding
- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — run it, deploy it, use it daily

`server.py` is a separate Python MCP server for interactive product discovery
(Google Trends → ideas → Shopify → Meta). Optional, deploys separately.

Copy `.env.example` to `.env.local` — every variable is documented there,
including what breaks without it.
