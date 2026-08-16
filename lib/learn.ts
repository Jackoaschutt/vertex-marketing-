/**
 * The learning path.
 *
 * Every step carries the reason it exists, because the reasoning is the part
 * worth keeping — the tick is just a record that you looked. Nothing here is a
 * claim about any product; these are checks you perform.
 */

export interface Step {
  key: string
  label: string
  why: string
}

export interface Stage {
  key: string
  title: string
  blurb: string
  steps: Step[]
}

export const STAGES: Stage[] = [
  {
    key: 'find',
    title: 'Finding something worth selling',
    blurb: 'Most money is lost here, before a single ad runs.',
    steps: [
      {
        key: 'problem',
        label: 'Write the problem in one sentence, without naming the product',
        why: 'If you cannot state the problem without the product, there is no demand to capture — only a thing you liked the look of.',
      },
      {
        key: 'buyer',
        label: 'Name the specific buyer, not a demographic',
        why: '"Women 25–45" is not a buyer. "People who share a bedroom with someone on a different schedule" is, and it tells you what the ad should say.',
      },
      {
        key: 'demand',
        label: 'Find real evidence people already want it',
        why: 'A search trend, marketplace volume, or an existing seller with visible traction. Your own enthusiasm is not evidence.',
      },
      {
        key: 'competition',
        label: 'Find who already sells it and at what price',
        why: 'No competition usually means no market. Heavy competition from real brands means you cannot win on price or ads.',
      },
    ],
  },
  {
    key: 'numbers',
    title: 'Making the numbers work',
    blurb: 'A product that cannot carry its own ad cost is not a product.',
    steps: [
      {
        key: 'landed',
        label: 'Work out the true landed cost, including shipping',
        why: 'Unit cost without shipping has killed more first stores than bad advertising.',
      },
      {
        key: 'margin',
        label: 'Check the margin survives a realistic ad cost',
        why: 'Gross margin has to cover getting the customer and still leave something. If it only works at a cost-per-sale you have never actually achieved, it does not work.',
      },
      {
        key: 'breakeven',
        label: 'Write down what you can afford to pay for one sale',
        why: 'That single number is what tells you, mid-test, whether to continue or stop. Without it every result gets rationalised.',
      },
    ],
  },
  {
    key: 'test',
    title: 'Testing it properly',
    blurb: 'A test you cannot measure is just spending.',
    steps: [
      {
        key: 'budget',
        label: 'Set a kill budget and a deadline before spending anything',
        why: 'Deciding when to stop while you are losing money is the decision you are least able to make well. Make it in advance.',
      },
      {
        key: 'track',
        label: 'Enter your spend and sales here every day it runs',
        why: 'This is the instrument. A test you only look at afterwards teaches you nothing about when it turned.',
      },
      {
        key: 'one-thing',
        label: 'Change one thing at a time',
        why: 'Change the creative and the price together and you learn nothing from either result.',
      },
      {
        key: 'decide',
        label: 'Make the call at the deadline, in writing',
        why: 'Continue, change one thing, or kill it. Writing it down is what turns money spent into a lesson learned.',
      },
    ],
  },
  {
    key: 'learn',
    title: 'Getting better each time',
    blurb: 'The only real compounding asset here is your judgement.',
    steps: [
      {
        key: 'postmortem',
        label: 'Write what happened while you still remember it',
        why: 'A week later you will remember the outcome but not your reasoning, and the reasoning is the useful part.',
      },
      {
        key: 'cause',
        label: 'Name the actual cause, not the outcome',
        why: '"It failed" is not a cause. "I could not make video of it that held attention" is, and it tells you what to avoid next time.',
      },
      {
        key: 'pattern',
        label: 'Read your old notes before starting the next one',
        why: 'Most people repeat the same mistake three times because they never look back. Ten minutes of reading beats a month of testing.',
      },
    ],
  },
]

export const TOTAL_STEPS = STAGES.reduce((n, s) => n + s.steps.length, 0)

export function stepId(stageKey: string, stepKey: string): string {
  return `${stageKey}:${stepKey}`
}

export function completedCount(checklist: Record<string, boolean>): number {
  return STAGES.reduce(
    (n, stage) => n + stage.steps.filter((s) => checklist[stepId(stage.key, s.key)]).length,
    0
  )
}
