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
  if (/learn|progress|checklist|next step|read|studied/.test(q)) {
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
      `Right now that is ${data.entries.length} money entr${data.entries.length === 1 ? 'y' : 'ies'}, ${data.notes.length} note${data.notes.length === 1 ? '' : 's'}, and ${completedCount(data.checklist)} of ${TOTAL_STEPS} steps done.`,
      'Try asking about this month, where your money is going, whether you are profitable, or what to do next.',
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

  if (data.entries.length > 20 && !data.lastExportAt) {
    out.push('You have enough in here to be worth backing up. Export takes one tap.')
  }

  return out
}
