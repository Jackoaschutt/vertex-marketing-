/**
 * Single source of truth for brand identity.
 *
 * Everything the storefront renders — name, positioning, voice, policy copy,
 * contact details — reads from here. Rebranding the store is editing this file;
 * no component hard-codes a brand string.
 *
 * The default brand is "Vesper": a considered-goods brand for the end of the
 * day (rest, wind-down, focus). It is deliberately a *category* brand rather
 * than a random-product store, so it can outlive any single winning product.
 *
 * LEGAL: the entity, address and registration fields below are placeholders.
 * They must be replaced with real details before taking real money. Nothing in
 * this file invents a registration number, certification or accreditation.
 */

export const brand = {
  name: 'Vesper',
  legalName: 'Vesper Commerce Co.', // PLACEHOLDER — replace with the registered entity
  domain: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  storePath: '/store',

  tagline: 'For the end of the day.',
  positioning:
    'Considered objects for winding down — better sleep, quieter evenings, calmer mornings.',
  promise:
    'We sell a short list of things we would keep. Each one solves a specific problem at the end of a long day.',

  /**
   * Voice rules. These are passed verbatim into the AI copy pipeline, so
   * changing them changes generated copy.
   */
  voice: {
    is: ['plain', 'specific', 'unhurried', 'confident without shouting'],
    isNot: ['hypey', 'urgent', 'salesy', 'exclamation-heavy', 'jargon-filled'],
    rules: [
      'Write like a knowledgeable friend, not a landing page.',
      'Lead with the problem the reader recognises, then the mechanism.',
      'Concrete nouns over adjectives. No "revolutionary", "game-changing", "must-have".',
      'Never manufacture urgency or scarcity.',
      'Short sentences. No more than one idea per sentence.',
    ],
  },

  /** Hard prohibitions enforced in the prompt and re-checked after generation. */
  claimsPolicy: [
    'Never state or imply a medical, therapeutic, or health outcome.',
    'Never invent certifications, test results, awards, or regulatory approvals.',
    'Never invent reviews, testimonials, customer counts, or star ratings.',
    'Never invent statistics, percentages, or study references.',
    'Never promise a guarantee that is not in the published returns policy.',
    'Never claim scarcity, countdowns, or "selling fast".',
  ],

  categories: [
    { slug: 'sleep', name: 'Sleep', blurb: 'Fall asleep faster, stay asleep longer.' },
    { slug: 'light', name: 'Light', blurb: 'Warm, low light for the last hours of the day.' },
    { slug: 'sound', name: 'Sound', blurb: 'Quiet a room, or fill it with the right noise.' },
    { slug: 'recovery', name: 'Recovery', blurb: 'Unwind the body before it hits the pillow.' },
    { slug: 'desk', name: 'Focus', blurb: 'Finish the day cleanly so the evening is yours.' },
  ],

  /** Real, verifiable trust signals only. No fabricated social proof. */
  trust: [
    { title: '30-day returns', body: 'Unused and in original packaging. Full policy on the returns page.' },
    { title: 'Tracked delivery', body: 'Every order ships with a tracking number, emailed on dispatch.' },
    { title: 'Real support', body: 'A person answers. Replies within one business day.' },
    { title: 'Honest pricing', body: 'One price. No fake discounts, no invented compare-at prices.' },
  ],

  /**
   * PLACEHOLDERS — replace before launch. These are used on the contact page
   * and in policy pages. They deliberately read as placeholders so a
   * half-configured store is obvious rather than convincingly wrong.
   */
  contact: {
    supportEmail: process.env.COMMERCE_SUPPORT_EMAIL ?? 'support@example.com',
    fromEmail: process.env.COMMERCE_FROM_EMAIL ?? 'orders@example.com',
    addressLines: ['[Registered business address]', '[City, Region, Postcode]', '[Country]'],
    responseWindow: 'within 1 business day',
  },

  shipping: {
    freeThresholdCents: 7500,
    flatRateCents: 595,
    processingDays: '1–2 business days',
    deliveryWindow: '7–14 business days',
    regions: 'We currently ship to addresses in the United States, Canada, the UK, the EU and Australia.',
  },

  returns: {
    windowDays: 30,
    condition: 'unused and in original packaging',
    whoPaysReturn: 'customer',
    refundWindow: '5–10 business days after we receive the item',
  },

  social: {
    // Only fill these in when the accounts actually exist — an empty string
    // hides the link rather than rendering a dead one.
    instagram: process.env.COMMERCE_INSTAGRAM ?? '',
    tiktok: process.env.COMMERCE_TIKTOK ?? '',
  },
} as const

export type Brand = typeof brand

export function storeUrl(path = ''): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${brand.storePath}${clean === '/' ? '' : clean}`
}

export function absoluteUrl(path: string): string {
  const base = brand.domain.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
