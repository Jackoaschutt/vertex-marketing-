/**
 * The fixed vocabulary of causes.
 *
 * Post-mortems written in free text are unreadable in aggregate — you end up
 * with forty stories and no pattern. Tagging every outcome from one list is
 * what lets the tool say "four of your five losers had the same cause", which
 * is the only way a single operator learns faster than one product at a time.
 *
 * These are causes the owner attests to, never inferred by the system.
 */

export interface Factor {
  key: string
  label: string
  /** Which side of the outcome this usually sits on. Used only for grouping. */
  polarity: 'positive' | 'negative' | 'neutral'
}

export const FACTORS: Factor[] = [
  // Demand and positioning
  { key: 'real-problem', label: 'Solved a problem people already had', polarity: 'positive' },
  { key: 'no-demand', label: 'Nobody actually wanted it', polarity: 'negative' },
  { key: 'wrong-audience', label: 'Aimed at the wrong buyer', polarity: 'negative' },
  { key: 'clear-angle', label: 'The angle was obvious and specific', polarity: 'positive' },
  { key: 'weak-angle', label: 'Never found an angle that landed', polarity: 'negative' },

  // Economics
  { key: 'strong-margin', label: 'Margin left room for ads', polarity: 'positive' },
  { key: 'thin-margin', label: 'Margin too thin to pay for traffic', polarity: 'negative' },
  { key: 'cost-rose', label: 'Supplier cost rose after launch', polarity: 'negative' },
  { key: 'priced-wrong', label: 'Priced too low or too high', polarity: 'negative' },
  { key: 'high-cpa', label: 'Acquisition cost never came down', polarity: 'negative' },

  // Creative and channel
  { key: 'creative-worked', label: 'Creative did the selling', polarity: 'positive' },
  { key: 'creative-weak', label: 'Could not make creative that converted', polarity: 'negative' },
  { key: 'creative-fatigue', label: 'Creative burned out and was not replaced', polarity: 'negative' },
  { key: 'channel-fit', label: 'Right product for the channel', polarity: 'positive' },
  { key: 'ad-account', label: 'Ad account or policy problems', polarity: 'negative' },

  // Operations
  { key: 'fast-shipping', label: 'Delivery was fast enough', polarity: 'positive' },
  { key: 'slow-shipping', label: 'Shipping times caused refunds', polarity: 'negative' },
  { key: 'quality', label: 'Product quality caused returns', polarity: 'negative' },
  { key: 'stockout', label: 'Ran out of stock at the wrong moment', polarity: 'negative' },
  { key: 'supplier-unreliable', label: 'Supplier could not keep up', polarity: 'negative' },

  // Competition and timing
  { key: 'saturated', label: 'Market was already saturated', polarity: 'negative' },
  { key: 'seasonal', label: 'Seasonality, good or bad', polarity: 'neutral' },
  { key: 'copied', label: 'Copied quickly by competitors', polarity: 'negative' },
  { key: 'early', label: 'Got there before the crowd', polarity: 'positive' },

  // Process — the ones that are about the operator, not the product
  { key: 'killed-late', label: 'Kept spending after it was clearly dead', polarity: 'negative' },
  { key: 'killed-early', label: 'Killed it before it had a fair test', polarity: 'negative' },
  { key: 'no-tracking', label: 'Did not track well enough to tell', polarity: 'negative' },
  { key: 'followed-process', label: 'Followed the process and it paid off', polarity: 'positive' },
]

export const FACTOR_BY_KEY = new Map(FACTORS.map((f) => [f.key, f]))

export function factorLabel(key: string): string {
  return FACTOR_BY_KEY.get(key)?.label ?? key
}
