/**
 * The process, written down.
 *
 * These checklists are the "learning" half of the tool. The rubric in
 * scoring.ts tells you whether a candidate is good; this tells you what to
 * actually do at each stage, in order, so the method is learned by being
 * followed rather than read once and forgotten.
 *
 * Every item is a check the owner performs — nothing here is automated, and
 * nothing here is a claim about a product. Ticking an item is a record that a
 * human looked.
 */

import type { ProductStatus } from '../types'

export type Stage = 'research' | 'validation' | 'testing' | 'scaling' | 'review'

export interface ChecklistItem {
  key: string
  label: string
  /** Why this step exists. Shown inline — the reasoning is the lesson. */
  why: string
}

export const STAGE_LABELS: Record<Stage, string> = {
  research: 'Research',
  validation: 'Validation',
  testing: 'Testing',
  scaling: 'Scaling',
  review: 'Review',
}

export const STAGE_ORDER: Stage[] = ['research', 'validation', 'testing', 'scaling', 'review']

export const CHECKLISTS: Record<Stage, ChecklistItem[]> = {
  research: [
    {
      key: 'problem',
      label: 'Write the problem in one sentence, without naming the product',
      why: 'If the problem cannot be stated without the product, there is no demand to capture — only a thing you liked the look of.',
    },
    {
      key: 'buyer',
      label: 'Name the specific buyer, not a demographic',
      why: '"Women 25–45" is not a buyer. "People who share a bedroom with someone on a different schedule" is, and it tells you what the ad should say.',
    },
    {
      key: 'demand',
      label: 'Collect a real demand signal',
      why: 'Search trend, marketplace volume, or an existing seller with visible traction. An opinion about demand is not a signal.',
    },
    {
      key: 'competition',
      label: 'Find who already sells it and at what price',
      why: 'No competition usually means no market. Heavy competition from brands means you cannot win on price or ads.',
    },
    {
      key: 'cost',
      label: 'Get a real landed cost, including shipping',
      why: 'Unit cost without shipping has killed more first stores than bad ads. The margin score is computed from this number, so a guess poisons the score.',
    },
    {
      key: 'margin',
      label: 'Check the margin survives a realistic ad cost',
      why: 'Gross margin must cover customer acquisition and still leave profit. If it only works at a CPA you have never actually achieved, it does not work.',
    },
  ],
  validation: [
    {
      key: 'score',
      label: 'Score it against the rubric and record the inputs',
      why: 'The score is only as honest as what you fed it. Recording the inputs is what lets a later post-mortem tell you whether you were wrong or unlucky.',
    },
    {
      key: 'angle',
      label: 'Write three different ad angles',
      why: 'One angle is a guess. Three forces you to find the one that is about the buyer rather than the object.',
    },
    {
      key: 'creative',
      label: 'Confirm you can actually make the creative',
      why: 'A product you cannot show working is a product you cannot sell on video. Decide this before spending, not after.',
    },
    {
      key: 'supplier',
      label: 'Confirm the supplier can fulfil at your volume and speed',
      why: 'Long or unreliable shipping produces refunds, and refunds turn a winning ROAS into a loss after the fact.',
    },
    {
      key: 'legal',
      label: 'Check for claims you would not be allowed to make',
      why: 'Anything health, safety or results-related restricts what the ad can say — and platforms enforce it. Find out now.',
    },
  ],
  testing: [
    {
      key: 'budget',
      label: 'Set a kill budget and a deadline before spending anything',
      why: 'Deciding when to stop while you are losing money is the decision you are least able to make well. Make it in advance.',
    },
    {
      key: 'metric',
      label: 'Write down the number that means "this works"',
      why: 'Without a stated threshold, every result gets rationalised. Name the ROAS or CPA that would justify continuing.',
    },
    {
      key: 'ledger',
      label: 'Enter spend and sales daily while the test runs',
      why: 'A test you cannot measure daily is a test you will end by feel. The ledger is the test instrument.',
    },
    {
      key: 'one-variable',
      label: 'Change one variable at a time',
      why: 'Change creative and price together and you learn nothing from either result.',
    },
    {
      key: 'decision',
      label: 'Make the call at the deadline, in writing',
      why: 'Continue, change one thing, or kill. Writing it down is what turns a spend into a lesson.',
    },
  ],
  scaling: [
    {
      key: 'margin-holds',
      label: 'Confirm the margin holds at higher volume',
      why: 'Costs move with volume in both directions. Verify before committing budget.',
    },
    {
      key: 'stock',
      label: 'Confirm the supplier can hold the pace',
      why: 'Scaling into a stockout converts your best month into refunds and a damaged account.',
    },
    {
      key: 'increments',
      label: 'Raise budget in increments, not steps',
      why: 'Large jumps reset the platform’s learning and can destroy a working campaign overnight.',
    },
    {
      key: 'watch',
      label: 'Re-check ROAS after every increase',
      why: 'ROAS almost always falls as spend rises. The question is whether it stays above the number you set.',
    },
  ],
  review: [
    {
      key: 'postmortem',
      label: 'Write the post-mortem',
      why: 'The product is over; the lesson is the only thing left worth keeping.',
    },
    {
      key: 'factors',
      label: 'Tag what actually caused the outcome',
      why: 'Tagged causes are what let the tool show you a pattern across products instead of one story at a time.',
    },
    {
      key: 'playbook',
      label: 'Add anything reusable to the playbook',
      why: 'A lesson attached to one dead product is lost. A lesson in the playbook is there for the next one.',
    },
  ],
}

/** Which checklist applies to a product in a given lifecycle status. */
export function stageForStatus(status: ProductStatus): Stage | null {
  switch (status) {
    case 'researching':
      return 'research'
    case 'validation':
    case 'approved':
      return 'validation'
    case 'testing':
      return 'testing'
    case 'scaling':
      return 'scaling'
    case 'winner':
    case 'loser':
      return 'review'
    case 'rejected':
      return null
    default:
      return null
  }
}

export function totalItems(): number {
  return STAGE_ORDER.reduce((sum, stage) => sum + CHECKLISTS[stage].length, 0)
}
