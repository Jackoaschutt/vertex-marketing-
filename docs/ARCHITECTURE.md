# Architecture

> **Status legend used throughout this repo**
> `REAL` — implemented and functional.
> `MOCK` — deliberate stand-in with a real interface behind it; labelled in code and UI.
> `UNVERIFIED` — real code against a real API, never run against a live account.
> `TODO` — interface exists, implementation does not.

---

## 1. What this is

A private tool for one operator. They research products here, sell wherever they
actually sell, and keep the books here. There is no storefront and no public
surface: every path requires a passcode.

This is the third shape of this repository, and the history matters because it
explains why the code is arranged the way it is:

| Was | Became | Why |
| --- | --- | --- |
| PropGuard, a prop-firm trading journal | Removed | The owner retired the idea. |
| A full dropshipping storefront with checkout and fulfilment | Removed | The owner does not want to sell from this app. |
| A research and bookkeeping cockpit | Current | What they actually needed. |

Each removal was clean because of one decision made at the start: commerce code
never imported PropGuard code, and the research/analytics layers never imported
the storefront. Deleting a layer was a deletion, not an untangling.

---

## 2. The shape

```
   ┌──────────────────────────────────────────────────────────────┐
   │  /unlock          one passcode → HMAC session cookie          │
   └───────────────┬──────────────────────────────────────────────┘
                   │  every other path requires it
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  RESEARCH        rubric · stage checklists · SerpAPI signals  │
   │  BOOKS           hand-entered daily ledger                    │
   │  LEARNING        playbook · post-mortems · coach              │
   └───────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  PROFIT ENGINE   lib/commerce/analytics/profit.ts             │
   │  ledger + ad spend + expenses → every financial figure        │
   │  nothing cached, nothing estimated                            │
   └───────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  DATA LAYER      driver-swappable                             │
   │  SupabaseDriver (service role, server only)                   │
   │  MemoryDriver   (seeded demo, used when no database is set)   │
   └──────────────────────────────────────────────────────────────┘
```

| Concern | Where |
| --- | --- |
| Screens | `app/ops/*` |
| HTTP API | `app/api/commerce/*` |
| Domain code | `lib/commerce/*` |
| UI | `components/ops/*` |
| Database | `ds_*` tables, migrations `011` and `012` |

---

## 3. Access control

One secret, `ADMIN_PASSCODE`.

Unlocking sets a cookie whose value is `HMAC-SHA256(passcode, "ops-session-v1")`
— derived, never the passcode itself. There is no session table to maintain and
no second secret to leak, and rotating the passcode invalidates every existing
session for free. Comparison is constant-time. Unlock attempts are rate limited
to 8 per minute per IP, because a single passcode has no account lockout behind
it and throttling is the only thing between it and offline-speed guessing.

An unset passcode denies everyone. The failure mode of a misconfigured
deployment must be "nobody gets in", never "everybody does" — this holds real
financials.

Supabase Auth and the email allowlist were removed with the storefront: two
moving parts and an account to maintain, for a tool with exactly one user.

---

## 4. The books

**Grain.** One row per product per channel per day. Per-order rows would be
punishing to type by hand and produce an identical P&L, so the ledger records
the day.

**Upsert, not insert.** `ds_sales` is unique on `(day, product_id, channel)` and
the write path upserts. Re-entering a day corrects it. An insert-only ledger
would silently double-count on the second entry, which is the single most
damaging thing a bookkeeping tool can do.

**One source of truth.** The denormalised counters that used to live on
`ds_products` (`revenue_cents`, `orders_count`, and so on) are deleted. Every
figure is computed from the ledger, ad spend and expenses at request time. A
bookkeeping tool with two answers to "what did this earn" is worse than one with
none, and this is why correcting a single day corrects the whole history at once.

**Three invariants**, each covered by a test:

1. Revenue is not profit. Separate fields, never conflated in a return value or
   a label.
2. Refunds reduce revenue. A refunded sale is not income.
3. A rate with no denominator is `null`. Zero ad spend is not infinite ROAS; no
   sales is not a 0% margin.

**Unattributed ad spend** is reported, never spread. It counts toward
whole-business profit but no product's ROAS, and every page showing both says
why the parts do not sum to the whole. Spreading it evenly would invent a number.

**Deleting a product with ledger history is refused.** It would cascade to the
sales rows and rewrite months already closed. The error says to mark it a loser
instead, which keeps the history and the lesson.

---

## 5. Research

The 100-point rubric is unchanged: Demand 20, Margin 15, Competition 15,
Problem 15, Creative 10, Brandability 10, Shipping 5, Repeat 5, Risk 5. Margin
and shipping sub-scores are computed from the real cost, price and ship time
rather than judged, so they cannot be talked up.

**Signals** (`lib/commerce/research/signals.ts`) fetch Google Trends and Google
Shopping result counts through SerpAPI. Two decisions worth noting:

- The raw payload is stored alongside the derived score, so any number on screen
  can be traced back to what produced it.
- Trend direction comes from the mean of the first third of the series against
  the last third, with a 15% threshold — not from the last two points. One spike
  should not read as growth.

Without `SERPAPI_KEY` the endpoint returns 503 naming the variable. It never
produces a plausible-looking result, because a fabricated trend would feed the
demand score and make an unvalidated candidate look validated.

---

## 6. Learning

Four parts, and the design intent of each:

**Stage checklists** (`research/checklist.ts`) — 23 steps across research →
validation → testing → scaling → review. Every item carries a `why`, shown
inline, because the reasoning is the lesson; the checkbox is just the record
that a human looked.

**Playbook** — free-form notes, deliberately unvalidated. The system does not
rewrite or "improve" the owner's own writing. The only structure imposed is a
kind and tags, which is what makes it findable later.

**Post-mortems** — the figures are snapshotted into the row at the time of
writing, so the story and the numbers it was written about can never drift
apart. Causes come from a fixed vocabulary of 28 (`research/factors.ts`) rather
than free text, because free text cannot be counted, and counting is the entire
point: "four of your five losers had the same cause" is a thing one operator
cannot see unaided.

**The coach** extends the grounded analyst. It computes the metric bundle from
the ledger first, then answers only from it, and reasons about causes from the
owner's own post-mortems rather than generic advice.

---

## 7. Automation

Jobs are advisory. Nothing here edits a product, a price or a status — that
matters more in a tool meant to build judgement than it did in a shop.

| Job | Cadence | What it is for |
| --- | --- | --- |
| `jobImportAdSpend` | daily | Pulls real Meta spend so the ROAS checks run on fresh figures. Failure raises a critical recommendation rather than passing silently. |
| `jobLedgerGaps` | daily | **The safety net.** A hand-kept ledger fails quietly — you stop entering and everything downstream is wrong while still looking fine. Finds days with ad spend and no sales row. |
| `jobAdPerformance` | daily | ROAS against target, both directions. |
| `jobStalledResearch` | weekly | Candidates parked in a stage for two weeks with steps outstanding. |
| `jobWeeklyReview` | weekly | Winner/loser classification, thin-margin warnings, and chasing missing post-mortems. |

---

## 8. Data layer

Repositories are the only API the rest of the system uses. Nothing above them
knows whether it is talking to Postgres or the demo driver.

`SupabaseDriver` is the only module that touches `SUPABASE_SERVICE_ROLE_KEY`.
Every `ds_` table has RLS enabled with **no** policies, so the anon key can read
nothing; the service-role key bypasses RLS and is the sole path in.

`MemoryDriver` is seeded and process-local. It exists so the whole tool runs and
can be tested with zero credentials, and `/ops` carries a permanent `DEMO DATA`
banner whenever it is active so it can never be mistaken for real books.

---

## 9. Integrations, stated honestly

| Integration | Status | Notes |
| --- | --- | --- |
| Supabase Postgres | REAL | Falls back to the labelled demo driver without credentials |
| Anthropic (copy + coach) | REAL | Deterministic fallbacks, badged `FALLBACK` in the UI |
| SerpAPI (demand + competition) | REAL | Returns an error rather than inventing data when the key is absent |
| Meta Marketing API | **UNVERIFIED** | Written to the documented API and covered by an integration test against a mock server; never run against a live ad account |
| CJdropshipping cost lookup | **UNVERIFIED** | Written to published API shapes; check one price by hand first |
| Mock supplier | **MOCK** | Simulated costs, tagged in every response |
| TikTok / Google Ads | **TODO** | Not built. Manual spend entry produces real figures |

---

## 10. Testing

`npm test` — 84 tests via `node --test`, no additional dependencies, compiled to
CommonJS in `.test-build/`.

The profit tests exist specifically to make the three ways this engine could lie
impossible. The Meta integration tests run against a mock Graph API and caught
an SSRF-shaped flaw during development: the client followed whatever absolute
URL appeared in a `paging.next` cursor, with the bearer token attached. It now
refuses any paging link whose origin differs from the configured Graph host.

`tests/system.test.ts` asserts every file path named on `/ops/system` exists, so
the inventory page cannot rot into a false claim.
