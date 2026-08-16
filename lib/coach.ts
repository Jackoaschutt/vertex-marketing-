/**
 * The coach.
 *
 * Runs entirely in your browser against your own entries. No API key, no
 * server, no data leaving the device.
 *
 * The rule it will not break: every answer is computed from what you actually
 * entered. It says "you have not recorded enough to answer that" rather than
 * producing a confident number from nothing — an invented figure about your own
 * money is worse than no answer, because you might act on it.
 */

import type { Data, Entry } from './store'
import { formatMoney, formatPercent, inMonth, monthKey, monthsPresent, totalsFor } from './money'
import { completedCount, STAGES, stepId, TOTAL_STEPS } from './learn'
import { assess, metricsFor, totalsAcross } from './ads'
import { compare, metricsFor as supplierMetrics, VETTING } from './sourcing'

export interface Answer {
  headline: string
  points: string[]
  /** What the data cannot tell you. Shown plainly rather than hidden. */
  caveats: string[]
}

export const SUGGESTIONS = [
  'How am I doing this month?',
  'Where is my money going?',
  'Am I actually profitable?',
  'How are my ads doing?',
  'Which supplier should I use?',
  'What should I do next?',
  'What have I learned so far?',
]

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function dataCaveats(data: Data): string[] {
  const caveats: string[] = []
  if (data.entries.length === 0) {
    caveats.push('Nothing has been entered yet, so every figure is zero because the book is empty — not because nothing happened.')
  } else if (data.entries.length < 10) {
    caveats.push(`Only ${data.entries.length} entries so far. Treat anything below as a rough shape, not a conclusion.`)
  }
  const days = new Set(data.entries.map((e) => e.day)).size
  if (days > 0 && days < 5) {
    caveats.push(`These cover ${days} day${days === 1 ? '' : 's'}. Too short a run to read a trend from.`)
  }
  return caveats
}

export function ask(question: string, data: Data): Answer {
  const q = question.toLowerCase()
  const caveats = dataCaveats(data)
  const all = totalsFor(data.entries)
  const month = thisMonth()
  const monthTotals = totalsFor(inMonth(data.entries, month))

  const empty = data.entries.length === 0

  // --- Where is the money going ---
  if (/where.*(money|going|spend)|biggest (cost|expense)|what.*costing/.test(q)) {
    if (all.expenseCents === 0) {
      return {
        headline: 'No expenses recorded yet.',
        points: ['Add what you have spent in Money and this will break it down by category.'],
        caveats,
      }
    }
    const top = all.byCategory.slice(0, 5)
    return {
      headline: `${top[0].category} is your biggest cost at ${formatMoney(top[0].cents)}, ${formatPercent(top[0].cents / all.expenseCents)} of everything you have spent.`,
      points: top.map(
        (c) => `${c.category}: ${formatMoney(c.cents)} (${formatPercent(c.cents / all.expenseCents)})`
      ),
      caveats,
    }
  }

  // --- Profitability ---
  if (/profit|making money|losing|worth it|break ?even/.test(q)) {
    if (empty) {
      return {
        headline: 'I cannot tell you yet — nothing is recorded.',
        points: ['Enter your income and costs in Money, even a few days of it, and ask again.'],
        caveats,
      }
    }
    const positive = all.profitCents >= 0
    return {
      headline: positive
        ? `You are up ${formatMoney(all.profitCents)} across everything recorded.`
        : `You are down ${formatMoney(Math.abs(all.profitCents))} across everything recorded.`,
      points: [
        `Money in: ${formatMoney(all.incomeCents)}. Money out: ${formatMoney(all.expenseCents)}.`,
        all.margin !== null
          ? `That is a margin of ${formatPercent(all.margin)} — of every pound that came in, ${formatPercent(all.margin)} stayed.`
          : 'No income recorded yet, so there is no margin to work out.',
        positive
          ? 'Worth checking this per month rather than in total — one good month can hide a run of bad ones.'
          : 'Being down early is normal while testing. What matters is whether the gap is closing, and whether you set a limit before you started.',
      ],
      caveats,
    }
  }

  // --- This month ---
  if (/this month|how am i doing|how.*going|right now|today/.test(q)) {
    if (inMonth(data.entries, month).length === 0) {
      const months = monthsPresent(data.entries)
      return {
        headline: 'Nothing recorded this month yet.',
        points: months.length
          ? [`Your last entry was in ${months[0]}. Keeping it current is what makes any of this worth reading.`]
          : ['Add your first entry in Money.'],
        caveats,
      }
    }
    return {
      headline:
        monthTotals.profitCents >= 0
          ? `This month you are up ${formatMoney(monthTotals.profitCents)}.`
          : `This month you are down ${formatMoney(Math.abs(monthTotals.profitCents))}.`,
      points: [
        `In: ${formatMoney(monthTotals.incomeCents)}. Out: ${formatMoney(monthTotals.expenseCents)}.`,
        monthTotals.byCategory.length > 0
          ? `Biggest cost is ${monthTotals.byCategory[0].category} at ${formatMoney(monthTotals.byCategory[0].cents)}.`
          : 'No costs recorded this month.',
        `All time you are ${all.profitCents >= 0 ? 'up' : 'down'} ${formatMoney(Math.abs(all.profitCents))}.`,
      ],
      caveats,
    }
  }

  // --- Learning progress ---
  if (/learn|progress|checklist|next step|\bread\b|studied/.test(q)) {
    const done = completedCount(data.checklist)
    const nextStage = STAGES.find((s) => s.steps.some((step) => !data.checklist[stepId(s.key, step.key)]))
    const nextStep = nextStage?.steps.find((step) => !data.checklist[stepId(nextStage.key, step.key)])
    return {
      headline:
        done === 0
          ? 'You have not started the checklist yet.'
          : done === TOTAL_STEPS
            ? 'You have been through every step. The next round is where it actually pays off.'
            : `You are ${done} of ${TOTAL_STEPS} steps in.`,
      points: [
        nextStep
          ? `Next: ${nextStep.label} — ${nextStep.why}`
          : 'Re-read your notes before the next product. That is the step most people skip.',
        `You have written ${data.notes.length} note${data.notes.length === 1 ? '' : 's'}.`,
        data.notes.length === 0
          ? 'Write one thing you got wrong recently. It is worth more than another video.'
          : 'Read your old notes before starting anything new.',
      ],
      caveats: [],
    }
  }

  // --- Ads ---
  // Word-bounded: a bare /ad/ also matches "already", "bad" and "made".
  if (/\bads?\b|\bcampaign|\broas\b|\bmeta\b|facebook|tiktok|\bcpa\b/.test(q)) {
    if (data.campaigns.length === 0) {
      return {
        headline: 'No campaigns recorded yet.',
        points: [
          'Add one in Ads with what you spent, what came back, how many sales, and what a unit costs you.',
          'That last number is the one that matters. ROAS without it cannot tell you whether you made money — a 3× ROAS is excellent on a 70% margin and a loss on a 25% one.',
        ],
        caveats,
      }
    }

    const t = totalsAcross(data.campaigns)
    const judged = data.campaigns.map((c) => ({ c, a: assess(c), m: metricsFor(c) }))
    const winners = judged.filter((j) => j.a.verdict === 'winning')
    const losers = judged.filter((j) => j.a.verdict === 'losing')
    const points: string[] = []

    points.push(
      `Across ${data.campaigns.length} campaign${data.campaigns.length === 1 ? '' : 's'}: ${formatMoney(t.spendCents)} spent, ${formatMoney(t.revenueCents)} back, ${t.purchases} sale${t.purchases === 1 ? '' : 's'}.`
    )
    points.push(
      t.netProfitCents >= 0
        ? `After the cost of the goods you are up ${formatMoney(t.netProfitCents)}.`
        : `After the cost of the goods you are down ${formatMoney(Math.abs(t.netProfitCents))}. Blended ROAS of ${t.roas?.toFixed(2) ?? '—'}× is not the whole story — the goods have to be paid for out of it.`
    )

    for (const j of losers.slice(0, 3)) {
      points.push(`${j.c.name}: ${j.a.headline}. ${j.a.action}`)
    }
    for (const j of winners.slice(0, 2)) {
      points.push(`${j.c.name}: ${j.a.headline}. ${j.a.action}`)
    }

    const noCost = judged.filter((j) => j.c.unitCostCents === 0)
    if (noCost.length > 0) {
      points.push(
        `${noCost.length} campaign${noCost.length === 1 ? ' has' : 's have'} no unit cost filled in, so ${noCost.length === 1 ? 'it is' : 'they are'} excluded from any profit judgement.`
      )
    }

    return {
      headline:
        losers.length > 0
          ? `${losers.length} campaign${losers.length === 1 ? ' is' : 's are'} losing money.`
          : winners.length > 0
            ? `${winners.length} campaign${winners.length === 1 ? ' is' : 's are'} profitable.`
            : 'Nothing is clearly winning or losing yet.',
      points,
      caveats,
    }
  }

  // --- Suppliers ---
  if (/supplier|sourc|cost per unit|landed|aliexpress|alibaba|cheaper/.test(q)) {
    if (data.suppliers.length === 0) {
      return {
        headline: 'No suppliers saved yet.',
        points: [
          'Add two or three for the same product in Suppliers and this will compare them on landed cost, speed, and how thoroughly you have checked them.',
          'Use the search links there — they open AliExpress, Alibaba, CJ and Amazon with your product already filled in.',
        ],
        caveats: [],
      }
    }

    const rows = compare(data.suppliers)
    const cheapest = rows[0]
    const points: string[] = []

    points.push(
      `${data.suppliers.length} supplier${data.suppliers.length === 1 ? '' : 's'} saved. Cheapest landed cost is ${cheapest.supplier.name} at ${formatMoney(cheapest.landedCents)}.`
    )

    if (rows.length > 1) {
      const dearest = rows[rows.length - 1]
      points.push(
        `The spread is ${formatMoney(dearest.landedCents - cheapest.landedCents)} per unit between cheapest and dearest. On 100 orders that is ${formatMoney((dearest.landedCents - cheapest.landedCents) * 100)}.`
      )
      const fastest = rows.find((r) => r.fastest)
      if (fastest && fastest.supplier.id !== cheapest.supplier.id) {
        points.push(
          `${fastest.supplier.name} is the fastest at ${fastest.supplier.leadDaysMax} days worst case, against ${cheapest.supplier.leadDaysMax} for the cheapest. Slow delivery causes refunds, and a refund costs you the whole sale, not the price difference.`
        )
      }
    }

    const unvetted = data.suppliers.filter((s) => supplierMetrics(s).vetted < 3)
    if (unvetted.length > 0) {
      points.push(
        `${unvetted.length} of them ${unvetted.length === 1 ? 'has' : 'have'} fewer than three checks done. Ordering a sample yourself is the one that catches the most expensive surprises.`
      )
    }

    const noSample = data.suppliers.filter((s) => !s.checks.sample)
    if (noSample.length === data.suppliers.length) {
      points.push('You have not ordered a sample from any of them. Do that before spending anything on ads.')
    }

    return { headline: 'Comparing on landed cost, not sticker price:', points, caveats: [] }
  }

  // --- What next ---
  if (/what.*(should|next|do)|advice|help|stuck/.test(q)) {
    const points: string[] = []
    if (empty) points.push('Record what you have spent so far, even roughly. You cannot manage what you have not written down.')
    if (all.expenseCents > 0 && all.incomeCents === 0) {
      points.push(`You have spent ${formatMoney(all.expenseCents)} with nothing recorded coming back. If that is real rather than just unrecorded, decide now what your limit is before you spend more.`)
    }
    const ads = all.byCategory.find((c) => c.category === 'Ads')
    if (ads && all.incomeCents > 0 && ads.cents > all.incomeCents) {
      points.push(`Ads have cost ${formatMoney(ads.cents)} against ${formatMoney(all.incomeCents)} of income. That is the number to fix before anything else.`)
    }
    for (const c of data.campaigns) {
      const a = assess(c)
      if (a.verdict === 'losing') points.push(`${c.name}: ${a.action}`)
    }
    if (data.suppliers.length > 0 && data.suppliers.every((s) => !s.checks.sample)) {
      points.push('You have not ordered a sample from any supplier yet. That is the cheapest way to avoid the most expensive mistake.')
    }
    const done = completedCount(data.checklist)
    if (done < TOTAL_STEPS) points.push(`You have ${TOTAL_STEPS - done} steps left in Learn. The ones about setting a kill budget are the ones that save money.`)
    if (data.entries.length > 20 && !data.lastExportAt) {
      points.push('Export a backup. Everything here lives in this browser, and clearing your history would take it with you.')
    }
    if (points.length === 0) points.push('Nothing is obviously wrong. Keep the book current and take a backup now and then.')
    return { headline: 'Based on what you have recorded:', points, caveats }
  }

  // --- Fallback: describe rather than guess ---
  return {
    headline: 'I can only answer from what you have entered here.',
    points: [
      `Right now that is ${data.entries.length} money entr${data.entries.length === 1 ? 'y' : 'ies'}, ${data.campaigns.length} campaign${data.campaigns.length === 1 ? '' : 's'}, ${data.suppliers.length} supplier${data.suppliers.length === 1 ? '' : 's'}, ${data.notes.length} note${data.notes.length === 1 ? '' : 's'}, and ${completedCount(data.checklist)} of ${TOTAL_STEPS} steps done.`,
      'Try asking about this month, where your money is going, how your ads are doing, which supplier to use, or what to do next.',
    ],
    caveats,
  }
}

/** Nudges shown on the overview, computed rather than generic. */
export function nudges(data: Data): string[] {
  const out: string[] = []
  const all = totalsFor(data.entries)

  if (data.entries.length === 0) {
    out.push('Start by adding what you have spent. Even a rough figure beats nothing.')
    return out
  }

  const days = new Set(data.entries.map((e) => e.day))
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (!days.has(yesterday) && !days.has(new Date().toISOString().slice(0, 10))) {
    out.push('Nothing recorded in the last couple of days. A gap now is a wrong number later.')
  }

  if (all.incomeCents === 0 && all.expenseCents > 0) {
    out.push(`${formatMoney(all.expenseCents)} spent with no income recorded yet. Worth knowing your limit.`)
  }

  for (const c of data.campaigns) {
    const a = assess(c)
    if (a.verdict === 'losing' && c.status !== 'killed' && c.status !== 'paused') {
      out.push(`${c.name} is losing money. ${a.action}`)
    }
  }

  if (data.entries.length > 20 && !data.lastExportAt) {
    out.push('You have enough in here to be worth backing up. Export takes one tap.')
  }

  return out
}
