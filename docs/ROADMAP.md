# Roadmap

Status per item: **DONE** (built and working) · **PARTIAL** (usable, gap noted) ·
**TODO** (interface exists, implementation pending) · **BLOCKED** (needs
credentials or an external account).

---

## Foundation · DONE

| Item | Status | Notes |
| --- | --- | --- |
| Access control | DONE | One passcode → HMAC session cookie, constant-time compare, rate-limited unlock. Unset denies everyone |
| Money handling | DONE | Integer minor units throughout; rates return `null` rather than a misleading zero |
| Driver-swappable data layer | DONE | Supabase driver + seeded memory driver, so the tool runs with zero credentials |
| Input validation | DONE | `lib/commerce/validate.ts` |
| Schema | DONE | `011_commerce_core.sql` + `012_research_and_books.sql`, 14 tables, RLS on all with no policies |
| Test harness | DONE | `npm test` — 84 tests, `node --test`, no new dependencies |
| System inventory | DONE | `/ops/system`, with every path asserted to exist by the test suite |

## Books · DONE

| Item | Status | Notes |
| --- | --- | --- |
| Daily sales ledger | DONE | One row per product per channel per day, upserted so re-entry corrects rather than double-counts |
| Expense tracking | DONE | Seven categories; these are what separate an apparently profitable month from a real one |
| Profit engine | DONE | Revenue, gross and net kept separate; refunds reduce revenue; every figure computed, never cached |
| Per-product P&L | DONE | Unattributed ad spend reported separately, never spread |
| Monthly and all-time views | DONE | `/ops/books` |
| Ledger-gap detection | DONE | Days with ad spend and no sales row, surfaced on the page and in the nightly job |
| CSV export | TODO | Nothing leaves the tool yet except by copy-paste |
| Multi-currency | TODO | Single currency assumed throughout |

## Research · DONE

| Item | Status | Notes |
| --- | --- | --- |
| 100-point rubric | DONE | Demand 20, Margin 15, Competition 15, Problem 15, Creative 10, Brandability 10, Shipping 5, Repeat 5, Risk 5 |
| Deterministic margin/shipping sub-scores | DONE | Computed from real cost, price and ship time, not judged |
| Lifecycle machine | DONE | `researching → validation → approved/rejected → testing → winner/loser → scaling`, enforced server-side |
| Google Trends signals | DONE | SerpAPI, raw payload stored, direction from thirds not endpoints |
| Competition signals | DONE | SerpAPI Shopping result counts |
| Refuses to fabricate | DONE | No key means a 503 naming the variable, never a plausible-looking trend |
| Signals feeding the score automatically | PARTIAL | Collected and displayed; the operator still sets the demand score by hand from them |

## Learning · PARTIAL

| Item | Status | Notes |
| --- | --- | --- |
| Stage checklists | DONE | 23 steps across five stages, each carrying why it exists |
| Checklist API + progress storage | DONE | Rejects item keys not in the definition |
| **Per-product checklist UI** | **TODO** | Progress shows on the products list and drives the stalled-research job, but there is no product view to tick items in |
| Playbook | DONE | Notes, lessons, ideas and sources; pinning; product links; tags |
| Post-mortems | DONE | Figures snapshotted at write time; 28 fixed causes |
| Pattern analysis | DONE | Causes counted across winners and losers |
| Coach | DONE | Grounded in the ledger, reasons about causes from your own post-mortems |
| Playbook search | TODO | Entries are listed and tagged but not searchable |

## Marketing · PARTIAL

| Item | Status | Notes |
| --- | --- | --- |
| Manual ad-spend entry | DONE | Produces genuine ROAS and CPA |
| Meta Ads client | DONE (**UNVERIFIED**) | Insights import, campaign creation (always PAUSED), interest resolution, account verification. Never run against a live ad account |
| Purchase de-duplication | DONE | `omni_purchase` wins over the others, so ROAS cannot be inflated threefold |
| Meta → product attribution | DONE | Explicit map, then `[vsp:<slug>]` marker; unattributed spend reported, never dropped |
| TikTok / Google clients | TODO | **BLOCKED** on tokens. Implement `AdChannelClient`; nothing else changes |

## Automation · DONE

| Item | Status | Notes |
| --- | --- | --- |
| Daily jobs | DONE | Ad import, ledger gaps, ROAS check |
| Weekly jobs | DONE | Stalled research, winner/loser review, missing post-mortems |
| Recommendation engine | DONE | Replaced each run, so the list is always "what is true now" |
| Auto-applying recommendations | Deliberately NOT built | The operator decides. In a tool meant to build judgement, automating the decision defeats the purpose |

---

## Known gaps, in priority order

1. **Per-product checklist UI.** The most-felt gap — the checklists exist and are
   enforced, but you cannot tick them from a product view.
2. **CSV export.** Your books should be portable out of here.
3. **Playbook search.** Fine at twenty entries, painful at two hundred.
4. **Verify Meta against a live account.** One day compared against Ads Manager
   moves it from UNVERIFIED to REAL.
5. **Multi-currency.** Only matters when you sell in more than one.
