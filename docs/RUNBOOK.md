# Runbook

How to run it, deploy it, and actually use it day to day.

---

## 1. Get in

One secret:

```
ADMIN_PASSCODE=something-long-you-will-remember
```

Set it, reload, go to `/unlock`, type it once. The session lasts 30 days per
device. Changing the passcode logs every device out — that is the revoke button.

Until it is set, the tool denies everyone including you. That is deliberate: a
half-configured deployment must never leave your financials open.

---

## 2. Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

With no `.env.local` at all it runs on seeded in-memory data, so you can click
through everything before connecting anything. `/ops` shows a permanent
`DEMO DATA` banner whenever that is the case.

```bash
npm run typecheck
npm test             # 84 tests
npm run build
```

---

## 3. Connect the database

1. Create a Supabase project.
2. Run both migrations in order: `011_commerce_core.sql`, then
   `012_research_and_books.sql`.
3. Set:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
4. Reload. **If the `DEMO DATA` banner is still there, it is not connected** and
   nothing you type is being saved.

Every `ds_` table has RLS on with no policies, so the anon key can read nothing.
All access is server-side through the service-role key.

---

## 4. The daily habit

This is the part that decides whether the tool is worth anything.

**Once a day, enter yesterday.** `/ops/books` → Record a day. Units, revenue,
cost of goods, inbound shipping, fees, refunds. It defaults to yesterday because
a day is not finished until it is over.

**Enter zero days too.** "No sales on Tuesday" is a fact. Recording it stops the
gap warning and keeps your averages honest.

**Re-entering a day corrects it.** The ledger upserts on day + product + channel,
so fixing a mistake is just entering it again. You cannot double-count by
accident.

**If you skip a few days**, the Books page and the nightly job will both tell
you: any day with ad spend and no sales row is flagged. That warning is the
single most useful thing in here — a hand-kept ledger fails silently, and this
is what breaks the silence.

---

## 5. Running a product through

1. **Research** (`/ops/research`) — score the candidate. Margin and shipping are
   computed from your real numbers; the rest is your judgement.
2. **Collect signals** — with `SERPAPI_KEY` set, pull the trend and competition
   count. Without it, score demand by hand and note where the number came from.
3. **Work the checklist** — each stage has its steps, and each step says why it
   exists. The reasoning is the point; the tick is just the record.
4. **Test** — set a kill budget and a deadline *before* spending. Enter spend and
   sales daily while it runs.
5. **Decide at the deadline** — continue, change one variable, or kill.
6. **Write the post-mortem** — five minutes, tagged causes. This is what makes
   the pattern table on `/ops/postmortems` work, and it is worth more than the
   next product test.

---

## 6. Ad spend

**By hand:** `/ops/marketing` → Record spend. These figures are exactly as real
as imported ones.

**Meta, automatically:** set `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` and
`META_PAGE_ID`. Run the status check first — it round-trips the Graph API to
prove the token, account, version and permissions before anything is trusted.

Attribution to a product uses an explicit campaign map first, then a
`[vsp:<product-slug>]` marker in the campaign name. Anything matching neither is
imported with no product attached: it still counts toward total ad spend and
whole-business profit, but not toward any product's ROAS. That is reported on
every page that shows both, so the parts visibly do not sum to the whole.

⚠️ The Meta client has never been run against a live ad account. Treat the first
import as unverified until you have compared one day against Ads Manager.

---

## 7. Turn on the rest

```
ANTHROPIC_API_KEY=...   # ad copy and the coach; falls back to a rules engine
SERPAPI_KEY=...         # demand and competition data; no key means no data, never fake data
CRON_SECRET=...         # lets a scheduler run the jobs
```

Point any scheduler at:

```
POST /api/commerce/automations/run?set=daily
Authorization: Bearer $CRON_SECRET
```

Weekly: `?set=weekly`. Or press the button in `/ops/automations`.

Without a scheduler the jobs only run when you press the button — which means a
gap in your ledger goes unnoticed until you happen to look.

---

## 8. Deploy

1. Push. Vercel builds from `main`.
2. Set every variable that applies, `ADMIN_PASSCODE` first.
3. Set `NEXT_PUBLIC_APP_URL` to the production origin.

The build does not need the database to be reachable — nothing is prerendered
from it. A database outage produces a clear message, not a failed deploy.

---

## 9. Checklist before you trust it

- [ ] `ADMIN_PASSCODE` set, and you can unlock
- [ ] Supabase connected; `DEMO DATA` banner gone
- [ ] Both migrations run
- [ ] One real day entered, and the P&L matches what you expected
- [ ] `CRON_SECRET` set and the daily job firing
- [ ] `/ops/system` shows no blocking readiness items

---

## 10. Troubleshooting

| Symptom | Cause |
| --- | --- |
| Everything redirects to `/unlock` | `ADMIN_PASSCODE` not set, or the cookie was cleared |
| `/unlock` says nothing can unlock it | `ADMIN_PASSCODE` genuinely unset on the server |
| `DEMO DATA` banner will not go away | Supabase env vars missing or wrong; nothing is being saved |
| Profit reads zero with sales entered | Check the date — the window is calendar-based |
| ROAS shows `—` | No ad spend recorded in that window. A dash means no denominator, not zero |
| Per-product figures do not sum to the total | Unattributed ad spend. The page says how much |
| Signals endpoint returns 503 | `SERPAPI_KEY` unset. It refuses to invent a trend |

---

## 11. Where things live

```
app/ops/…                      the screens
app/api/commerce/…             HTTP API
app/unlock/                    the one public page

lib/commerce/
  auth.ts                      passcode gate, session token, cron secret
  config.ts                    which integrations are actually configured
  money.ts                     integer-cent helpers
  validate.ts                  request validation
  http.ts                      route helpers, error translation, rate limiting
  db/                          driver interface, Supabase driver, demo driver, repositories
  analytics/profit.ts          the books
  research/scoring.ts          the 100-point rubric + lifecycle machine
  research/checklist.ts        the 23 stage steps, each with its reason
  research/factors.ts          the fixed cause vocabulary
  research/signals.ts          SerpAPI collection
  suppliers/                   cost lookup adapters
  marketing/                   ad channel interface, Meta client, metric import
  ai/                          Anthropic client, content, guardrails, coach
  automation/jobs.ts           daily + weekly jobs
  system.ts                    the inventory behind /ops/system

components/ops/…               UI
tests/…                        node --test suite
supabase/migrations/           011 core, 012 research + books
```
