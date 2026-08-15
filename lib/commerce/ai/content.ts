/**
 * AI product-content pipeline.
 *
 * Input: supplier/product facts.
 * Output: a full content set — title, description, benefits, features, how it
 * works, specs, FAQ, meta tags, ad angles, UGC/TikTok hooks, Meta ad concepts,
 * email angles and branded image prompts.
 *
 * Two guarantees:
 *  1. Nothing is fabricated. The prompt forbids invented certifications,
 *     medical claims, reviews, results, statistics and guarantees, and
 *     guardrails.ts re-scans the output and strips anything that slips through.
 *  2. Without an API key this still returns usable content from a deterministic
 *     template, tagged generator:'fallback' and badged in the UI — it is never
 *     passed off as model output.
 */

import { brand } from '../brand'
import { formatMoney, grossMargin } from '../money'
import { generateJson } from './client'
import { sanitize, type GuardrailIssue } from './guardrails'
import type { GeneratedContent } from '../types'

export interface ContentInput {
  name: string
  category?: string | null
  tagline?: string | null
  problemSolved?: string | null
  targetAudience?: string | null
  supplierDescription?: string | null
  specs?: { label: string; value: string }[]
  priceCents: number
  costCents: number
  shipDaysMin: number
  shipDaysMax: number
}

export interface ContentResult {
  content: GeneratedContent
  generator: 'anthropic' | 'fallback'
  model: string | null
  issues: GuardrailIssue[]
  error: string | null
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'subtitle',
    'description',
    'benefits',
    'features',
    'howItWorks',
    'specifications',
    'faq',
    'metaTitle',
    'metaDescription',
    'adAngles',
    'ugcHooks',
    'tiktokHooks',
    'metaAdConcepts',
    'emailAngles',
    'imagePrompts',
  ],
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    description: { type: 'string' },
    benefits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'body'],
        properties: { heading: { type: 'string' }, body: { type: 'string' } },
      },
    },
    features: { type: 'array', items: { type: 'string' } },
    howItWorks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['step', 'body'],
        properties: { step: { type: 'string' }, body: { type: 'string' } },
      },
    },
    specifications: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value'],
        properties: { label: { type: 'string' }, value: { type: 'string' } },
      },
    },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer'],
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
      },
    },
    metaTitle: { type: 'string' },
    metaDescription: { type: 'string' },
    adAngles: { type: 'array', items: { type: 'string' } },
    ugcHooks: { type: 'array', items: { type: 'string' } },
    tiktokHooks: { type: 'array', items: { type: 'string' } },
    metaAdConcepts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['concept', 'primaryText', 'headline'],
        properties: {
          concept: { type: 'string' },
          primaryText: { type: 'string' },
          headline: { type: 'string' },
        },
      },
    },
    emailAngles: { type: 'array', items: { type: 'string' } },
    imagePrompts: { type: 'array', items: { type: 'string' } },
  },
}

function systemPrompt(): string {
  return [
    `You write product content for ${brand.name}, a consumer brand. Positioning: ${brand.positioning}`,
    ``,
    `VOICE`,
    `Is: ${brand.voice.is.join(', ')}.`,
    `Is not: ${brand.voice.isNot.join(', ')}.`,
    ...brand.voice.rules.map((r) => `- ${r}`),
    ``,
    `HARD RULES — a violation makes the output unusable:`,
    ...brand.claimsPolicy.map((r) => `- ${r}`),
    `- Only state facts that are given to you in the input. If a fact is not supplied, do not assert it.`,
    `- Where a specification is unknown, omit it rather than guessing a number.`,
    `- Do not write copy that reads as machine-generated: no triads of adjectives, no "elevate your", no "in today's fast-paced world", no rhetorical questions as openers.`,
    `- Persuasion comes from precision about the problem, not from intensity.`,
    ``,
    `Return JSON matching the provided schema and nothing else.`,
  ].join('\n')
}

function userPrompt(input: ContentInput): string {
  const margin = grossMargin(input.priceCents, input.costCents)
  return [
    `PRODUCT FACTS (the only facts you may assert):`,
    `Name: ${input.name}`,
    input.category ? `Category: ${input.category}` : '',
    input.tagline ? `Working tagline: ${input.tagline}` : '',
    input.problemSolved ? `Problem it solves: ${input.problemSolved}` : '',
    input.targetAudience ? `Who it is for: ${input.targetAudience}` : '',
    input.supplierDescription ? `Supplier description (may be poorly written; extract facts only): ${input.supplierDescription}` : '',
    input.specs?.length ? `Known specifications: ${input.specs.map((s) => `${s.label}: ${s.value}`).join('; ')}` : '',
    `Retail price: ${formatMoney(input.priceCents)}`,
    `Delivery window: ${input.shipDaysMin}–${input.shipDaysMax} business days`,
    margin !== null ? `(Internal, do not mention: gross margin ${(margin * 100).toFixed(0)}%.)` : '',
    ``,
    `WRITE:`,
    `- title: under 60 characters, the product name plus its clearest differentiator.`,
    `- subtitle: one sentence, the value proposition.`,
    `- description: 3 short paragraphs. Paragraph 1 names the problem the reader recognises. Paragraph 2 explains the mechanism. Paragraph 3 says who it suits and who it does not.`,
    `- benefits: 3–4 items, each a specific outcome with a one-sentence explanation.`,
    `- features: 5–7 concrete attributes drawn only from the facts above.`,
    `- howItWorks: 3 steps.`,
    `- specifications: only what is supplied above. An empty array is correct if nothing is known.`,
    `- faq: 5 questions a real buyer asks before purchase, including at least one about the delivery window and one about returns.`,
    `- metaTitle (<60 chars) and metaDescription (<155 chars).`,
    `- adAngles: 5 distinct positioning angles.`,
    `- ugcHooks: 5 first-person opening lines a creator could say on camera.`,
    `- tiktokHooks: 5 hooks under 12 words for the first 2 seconds.`,
    `- metaAdConcepts: 3, each with concept, primaryText (under 125 chars) and headline (under 40 chars).`,
    `- emailAngles: 4 subject-line angles.`,
    `- imagePrompts: 4 prompts for branded product photography — describe scene, light, surface, palette and mood consistent with the brand. No text overlays, no people's faces, no logos.`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Deterministic content used when no API key is present. Clearly labelled. */
export function fallbackContent(input: ContentInput): GeneratedContent {
  const name = input.name
  const problem = input.problemSolved ?? 'a small, repeated annoyance at the end of the day'
  const audience = input.targetAudience ?? 'people who want a calmer evening'
  const window = `${input.shipDaysMin}–${input.shipDaysMax} business days`

  return {
    title: name,
    subtitle: input.tagline ?? `Built for ${audience.toLowerCase()}.`,
    description: [
      `${problem[0].toUpperCase()}${problem.slice(1)}`,
      `${name} is our answer to it. [Add the mechanism here: what it does and why that works.]`,
      `It suits ${audience.toLowerCase()}. It is probably not for you if you need something [add the honest limitation here].`,
    ].join('\n\n'),
    benefits: [
      { heading: 'Solves one thing well', body: `[Describe the specific outcome ${name} produces.]` },
      { heading: 'Made to stay out of the way', body: '[Describe the design decision that supports this.]' },
      { heading: 'Simple to live with', body: '[Describe setup and daily use.]' },
    ],
    features: input.specs?.map((s) => `${s.label}: ${s.value}`) ?? ['[Add a concrete feature]'],
    howItWorks: [
      { step: 'Unbox and set up', body: '[One or two sentences.]' },
      { step: 'Use it as part of the routine', body: '[One or two sentences.]' },
      { step: 'Keep it going', body: '[Maintenance or charging, if any.]' },
    ],
    specifications: input.specs ?? [],
    faq: [
      { question: 'How long does delivery take?', answer: `Orders leave our supplier in ${brand.shipping.processingDays}, and typically arrive in ${window}. You get a tracking number by email on dispatch.` },
      { question: 'What if it is not right for me?', answer: `You have ${brand.returns.windowDays} days to return it ${brand.returns.condition}. Full details are on the returns page.` },
      { question: 'Where does it ship from?', answer: '[State the fulfilment origin honestly.]' },
      { question: 'Is there a warranty?', answer: '[State only what is actually offered.]' },
      { question: `Who is ${name} not for?`, answer: '[Name a genuine limitation. This builds more trust than another benefit.]' },
    ],
    metaTitle: `${name} | ${brand.name}`.slice(0, 60),
    metaDescription: `${input.tagline ?? name}. ${brand.returns.windowDays}-day returns and tracked delivery from ${brand.name}.`.slice(0, 155),
    adAngles: [
      `Problem-first: open on ${problem}`,
      'Mechanism: explain why it works, not that it works',
      'Comparison: what people try first and why it falls short',
      `Audience: made for ${audience.toLowerCase()}`,
      'Routine: where it fits in the last hour of the day',
    ],
    ugcHooks: [
      `I did not expect ${name.toLowerCase()} to change anything.`,
      'Here is what my evenings looked like before this.',
      'I tried three of these. This is the one I kept.',
      'Nobody talks about this part of winding down.',
      'If you also do this every night, watch.',
    ],
    tiktokHooks: [
      'The fix took under a minute',
      'This solved a nightly problem',
      'Three things I changed at night',
      'Stop doing this before bed',
      'I kept this one',
    ],
    metaAdConcepts: [
      { concept: 'Problem/solution split screen', primaryText: `${problem} — ${name} is a small fix for it.`, headline: name.slice(0, 40) },
      { concept: 'Product demo, hands only, warm light', primaryText: `How ${name} actually works.`, headline: 'See how it works' },
      { concept: 'Routine montage, last hour of the day', primaryText: `Made for ${audience.toLowerCase()}.`, headline: 'For the end of the day' },
    ],
    emailAngles: [
      'The problem, named plainly',
      'What we changed and why',
      'A short guide to the last hour of the day',
      'Honest limitations of the product',
    ],
    imagePrompts: [
      `Editorial product photograph of ${name} on a warm oak nightstand, single soft lamp from the left, deep shadow, sand and charcoal palette, calm evening mood, no text, no logos`,
      `Close macro of ${name} surface texture, raking warm light, shallow depth of field, muted neutral background`,
      `${name} in a dim bedroom scene at dusk, bed edge softly out of focus, warm 2700K light, no people's faces`,
      `Flat lay of ${name} with its accessories on linen, overhead soft north light, generous negative space, sand background`,
    ],
  }
}

export async function generateContent(input: ContentInput): Promise<ContentResult> {
  const result = await generateJson<GeneratedContent>({
    system: systemPrompt(),
    prompt: userPrompt(input),
    schema: SCHEMA,
    maxTokens: 8000,
  })

  if (!result.data) {
    return {
      content: fallbackContent(input),
      generator: 'fallback',
      model: null,
      issues: [],
      error: result.error,
    }
  }

  const scanned = sanitize(result.data)
  return {
    content: scanned.value,
    generator: 'anthropic',
    model: result.model,
    issues: scanned.issues,
    error: null,
  }
}
