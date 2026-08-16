/**
 * What the ad numbers actually mean.
 *
 * Ads Manager will happily show you a 3× ROAS on a product that is losing you
 * money, because it does not know what your goods cost. Everything here counts
 * the cost of the goods, which is the difference between a campaign that looks
 * good and one that is good.
 */

import type { Campaign } from './store'
import { safeDivide } from './money'

export interface CampaignMetrics {
  /** Revenue ÷ spend. What Ads Manager shows you. */
  roas: number | null
  /** What one purchase cost you in advertising. */
  cpaCents: number | null
  /** Average order value. */
  aovCents: number | null
  /** Revenue − goods − ad spend. The only number that matters. */
  netProfitCents: number
  /** Profit on one order before any advertising. This is your budget per sale. */
  contributionCents: number
  /** The ROAS at which you break even. Below this you are paying to lose money. */
  breakEvenRoas: number | null
  /** The most you can pay for a sale and still not lose money. */
  maxCpaCents: number | null
  profitable: boolean
}

export function metricsFor(c: Campaign): CampaignMetrics {
  const goodsCents = c.unitCostCents * c.purchases
  const netProfitCents = c.revenueCents - goodsCents - c.spendCents
  const aovCents = c.purchases > 0 ? Math.round(c.revenueCents / c.purchases) : null

  // Contribution per order: what is left of one sale before advertising.
  const contributionCents = aovCents !== null ? aovCents - c.unitCostCents : 0

  // If each order leaves £20 after goods, you can pay up to £20 to get one.
  const maxCpaCents = contributionCents > 0 ? contributionCents : null

  // Break-even ROAS is price ÷ contribution. A 40% margin needs 2.5×.
  const breakEvenRoas =
    aovCents !== null && contributionCents > 0 ? aovCents / contributionCents : null

  return {
    roas: safeDivide(c.revenueCents, c.spendCents),
    cpaCents: c.purchases > 0 ? Math.round(c.spendCents / c.purchases) : null,
    aovCents,
    netProfitCents,
    contributionCents,
    breakEvenRoas,
    maxCpaCents,
    profitable: netProfitCents > 0,
  }
}

export type Verdict = 'winning' | 'marginal' | 'losing' | 'too-early' | 'no-data'

export interface Assessment {
  verdict: Verdict
  headline: string
  reasoning: string[]
  action: string
}

/**
 * The judgement Ads Manager will not make for you.
 *
 * Deliberately conservative about small numbers: three purchases is not
 * evidence of anything, and saying so is more useful than a confident verdict
 * built on noise.
 */
export function assess(c: Campaign): Assessment {
  const m = metricsFor(c)

  if (c.spendCents === 0) {
    return {
      verdict: 'no-data',
      headline: 'Nothing spent yet',
      reasoning: ['Add the spend and results from Ads Manager and this will tell you where it stands.'],
      action: 'Before you start: decide what you will spend before killing it, and write it down.',
    }
  }

  if (c.unitCostCents === 0) {
    return {
      verdict: 'no-data',
      headline: 'Cannot judge this without your cost per unit',
      reasoning: [
        'ROAS on its own is meaningless. A 3× ROAS is excellent on a 70% margin and a loss on a 25% one.',
        'Add what one unit costs you, including the shipping you pay, and this becomes a real answer.',
      ],
      action: 'Fill in the unit cost.',
    }
  }

  if (c.purchases === 0) {
    const spentPerDay = c.spendCents
    return {
      verdict: spentPerDay > 5000 ? 'losing' : 'too-early',
      headline: spentPerDay > 5000 ? 'Spending with nothing back' : 'Too early to tell',
      reasoning: [
        'No purchases recorded yet.',
        spentPerDay > 5000
          ? 'You have spent enough that zero sales is itself the result. Something upstream is wrong — the offer, the price, the landing page, or the audience.'
          : 'A handful of clicks tells you nothing. Let it run to your planned test budget before reading anything into it.',
      ],
      action:
        spentPerDay > 5000
          ? 'Stop and check the basics before spending more: does the page load fast, is the price competitive, does the ad match what the page sells?'
          : 'Keep going to your kill budget, then decide.',
    }
  }

  const roasText = m.roas !== null ? `${m.roas.toFixed(2)}×` : '—'
  const beText = m.breakEvenRoas !== null ? `${m.breakEvenRoas.toFixed(2)}×` : '—'

  if (m.contributionCents <= 0) {
    return {
      verdict: 'losing',
      headline: 'You lose money on every order, before advertising',
      reasoning: [
        `Each order brings in about ${(m.aovCents ?? 0) / 100} and the goods cost ${c.unitCostCents / 100}.`,
        'No amount of advertising skill fixes this. More sales would mean bigger losses.',
      ],
      action: 'Raise the price or find a cheaper supplier. Do not spend another penny on ads until this is positive.',
    }
  }

  // Small samples get a hedged verdict rather than a confident one.
  if (c.purchases < 5) {
    return {
      verdict: 'too-early',
      headline: `${c.purchases} purchase${c.purchases === 1 ? '' : 's'} is not enough to judge`,
      reasoning: [
        `Currently ${roasText} against a break-even of ${beText}.`,
        'At this few orders the figure swings wildly with each new sale. It is a hint, not a result.',
        `You can afford up to ${((m.maxCpaCents ?? 0) / 100).toFixed(2)} per sale before losing money.`,
      ],
      action: 'Let it reach at least 10 purchases or your kill budget, whichever comes first.',
    }
  }

  if (m.roas !== null && m.breakEvenRoas !== null && m.roas >= m.breakEvenRoas * 1.4) {
    return {
      verdict: 'winning',
      headline: `Profitable — ${roasText} against a ${beText} break-even`,
      reasoning: [
        `Net ${m.netProfitCents >= 0 ? 'profit' : 'loss'} of ${Math.abs(m.netProfitCents) / 100} after goods and ad spend.`,
        `Each sale costs you ${((m.cpaCents ?? 0) / 100).toFixed(2)} and leaves ${(m.contributionCents / 100).toFixed(2)} before that.`,
        'Comfortably above break-even, with room for the figure to drop as you scale.',
      ],
      action:
        'Raise budget 20–30% and re-check in three days. Bigger jumps reset the platform’s learning and can kill a working campaign.',
    }
  }

  if (m.roas !== null && m.breakEvenRoas !== null && m.roas >= m.breakEvenRoas) {
    return {
      verdict: 'marginal',
      headline: `Just above water — ${roasText} against a ${beText} break-even`,
      reasoning: [
        `Net ${m.netProfitCents >= 0 ? '+' : '−'}${Math.abs(m.netProfitCents) / 100} once goods are counted.`,
        'Profitable, but with no margin for error. Returns, a price rise from your supplier, or a bad week would put this underwater.',
      ],
      action:
        'Do not scale this yet. Change one thing — creative, price, or audience — and see if it moves. Scaling a marginal campaign usually makes it a losing one.',
    }
  }

  return {
    verdict: 'losing',
    headline: `Losing money — ${roasText} against a ${beText} break-even`,
    reasoning: [
      `Down ${Math.abs(m.netProfitCents) / 100} after goods and ad spend.`,
      `Each sale is costing ${((m.cpaCents ?? 0) / 100).toFixed(2)} but only leaves ${(m.contributionCents / 100).toFixed(2)}.`,
      'The gap has to close by roughly the difference between those two numbers.',
    ],
    action:
      'Kill it, or change exactly one thing and give it a defined budget and deadline. The most common expensive mistake is keeping a losing campaign alive hoping it turns.',
  }
}

export function totalsAcross(campaigns: Campaign[]) {
  const live = campaigns.filter((c) => c.status !== 'killed')
  const spend = live.reduce((n, c) => n + c.spendCents, 0)
  const revenue = live.reduce((n, c) => n + c.revenueCents, 0)
  const goods = live.reduce((n, c) => n + c.unitCostCents * c.purchases, 0)
  const purchases = live.reduce((n, c) => n + c.purchases, 0)
  return {
    spendCents: spend,
    revenueCents: revenue,
    netProfitCents: revenue - goods - spend,
    purchases,
    roas: safeDivide(revenue, spend),
  }
}
