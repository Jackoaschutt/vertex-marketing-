import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  campaignNameFor,
  explainMetaError,
  extractAction,
  extractActionValueCents,
  productSlugFromCampaignName,
  splitRange,
  toDailyMetric,
  type MetaInsightsRow,
} from '../lib/commerce/marketing/adapter-meta'
import { attributeRows } from '../lib/commerce/marketing/import'
import type { ChannelDailyMetric } from '../lib/commerce/marketing/channels'

// --- Purchase extraction ---------------------------------------------------
// This is the single most dangerous transform in the integration: getting it
// wrong silently multiplies reported purchases and makes ROAS look great.

test('omni_purchase wins over the other purchase types and is not summed with them', () => {
  const actions = [
    { action_type: 'omni_purchase', value: '12' },
    { action_type: 'purchase', value: '12' },
    { action_type: 'offsite_conversion.fb_pixel_purchase', value: '12' },
  ]
  // 12, not 36 — Meta reports the same conversion under several action types.
  assert.equal(extractAction(actions), 12)
})

test('falls back through the purchase types in order', () => {
  assert.equal(extractAction([{ action_type: 'purchase', value: '5' }]), 5)
  assert.equal(
    extractAction([{ action_type: 'offsite_conversion.fb_pixel_purchase', value: '7' }]),
    7
  )
})

test('non-purchase actions are ignored', () => {
  const actions = [
    { action_type: 'link_click', value: '400' },
    { action_type: 'landing_page_view', value: '250' },
    { action_type: 'add_to_cart', value: '30' },
  ]
  assert.equal(extractAction(actions), 0)
})

test('missing or empty action arrays are zero, not NaN', () => {
  assert.equal(extractAction(undefined), 0)
  assert.equal(extractAction([]), 0)
  assert.equal(extractAction([{ action_type: 'purchase', value: 'not-a-number' }]), 0)
})

test('action values convert to integer cents with the same precedence', () => {
  const values = [
    { action_type: 'omni_purchase', value: '1249.50' },
    { action_type: 'purchase', value: '1249.50' },
  ]
  assert.equal(extractActionValueCents(values), 124950)
  assert.equal(extractActionValueCents(undefined), 0)
})

// --- Row mapping -----------------------------------------------------------

test('an insights row becomes a daily metric with money in cents', () => {
  const row: MetaInsightsRow = {
    date_start: '2026-08-01',
    date_stop: '2026-08-01',
    campaign_id: '23851234567890123',
    campaign_name: 'Halo Bedside Light — Aug 2026 [vsp:halo-bedside-light]',
    impressions: '41230',
    clicks: '638',
    spend: '52.47',
    actions: [
      { action_type: 'link_click', value: '638' },
      { action_type: 'omni_purchase', value: '7' },
    ],
    action_values: [{ action_type: 'omni_purchase', value: '343.00' }],
  }

  assert.deepEqual(toDailyMetric(row), {
    day: '2026-08-01',
    campaignRef: '23851234567890123',
    productRef: 'halo-bedside-light',
    impressions: 41230,
    clicks: 638,
    spendCents: 5247,
    purchases: 7,
    revenueCents: 34300,
  })
})

test('a sparse row (no spend, no conversions) maps to zeroes rather than NaN', () => {
  const metric = toDailyMetric({ date_start: '2026-08-02', campaign_id: 'c1', campaign_name: 'Test' })
  assert.equal(metric.spendCents, 0)
  assert.equal(metric.impressions, 0)
  assert.equal(metric.purchases, 0)
  assert.equal(metric.revenueCents, 0)
  assert.equal(metric.productRef, null)
})

// --- Campaign name markers -------------------------------------------------

test('the product marker is found anywhere in a campaign name', () => {
  assert.equal(productSlugFromCampaignName('[vsp:drift-sound-machine] broad US'), 'drift-sound-machine')
  assert.equal(productSlugFromCampaignName('Q3 test [VSP:Halo-Bedside-Light] v2'), 'halo-bedside-light')
  assert.equal(productSlugFromCampaignName('No marker here'), null)
  assert.equal(productSlugFromCampaignName(undefined), null)
})

test('generated campaign names round-trip through the parser', () => {
  const name = campaignNameFor('Halo Bedside Light', 'halo-bedside-light', new Date('2026-08-15T00:00:00Z'))
  assert.ok(name.includes('Halo Bedside Light'))
  assert.equal(productSlugFromCampaignName(name), 'halo-bedside-light')
})

// --- Attribution precedence ------------------------------------------------

function metric(over: Partial<ChannelDailyMetric> = {}): ChannelDailyMetric {
  return {
    day: '2026-08-01',
    campaignRef: 'c1',
    productRef: null,
    impressions: 0,
    clicks: 0,
    spendCents: 1000,
    purchases: 0,
    revenueCents: 0,
    ...over,
  }
}

test('an explicit campaign map beats the name marker', () => {
  const rows = [metric({ campaignRef: 'c1', productRef: 'drift-sound-machine' })]
  const result = attributeRows(rows, { c1: 'product-explicit' }, new Map([['drift-sound-machine', 'product-by-slug']]))
  assert.equal(result[0].productId, 'product-explicit')
})

test('the name marker is used when there is no explicit map', () => {
  const rows = [metric({ productRef: 'drift-sound-machine' })]
  const result = attributeRows(rows, {}, new Map([['drift-sound-machine', 'product-by-slug']]))
  assert.equal(result[0].productId, 'product-by-slug')
})

test('a marker naming a product that does not exist stays unattributed', () => {
  const rows = [metric({ productRef: 'deleted-product' })]
  const result = attributeRows(rows, {}, new Map([['halo', 'p1']]))
  assert.equal(result[0].productId, null)
})

test('no map and no marker leaves the row unattributed rather than guessing', () => {
  const result = attributeRows([metric()], {}, new Map())
  assert.equal(result[0].productId, null)
})

// --- Date range chunking ---------------------------------------------------

test('a short range is a single chunk', () => {
  assert.deepEqual(splitRange('2026-08-01', '2026-08-07'), [
    { since: '2026-08-01', until: '2026-08-07' },
  ])
})

test('a long range is split so Meta never silently truncates the answer', () => {
  const chunks = splitRange('2026-01-01', '2026-08-15')
  assert.ok(chunks.length > 2)
  assert.equal(chunks[0].since, '2026-01-01')
  assert.equal(chunks[chunks.length - 1].until, '2026-08-15')
  // Chunks must be contiguous and non-overlapping — an overlap would
  // double-import a day.
  for (let i = 1; i < chunks.length; i++) {
    const prevEnd = Date.parse(`${chunks[i - 1].until}T00:00:00Z`)
    const thisStart = Date.parse(`${chunks[i].since}T00:00:00Z`)
    assert.equal(thisStart - prevEnd, 86_400_000)
  }
})

test('a single-day range works', () => {
  assert.deepEqual(splitRange('2026-08-15', '2026-08-15'), [
    { since: '2026-08-15', until: '2026-08-15' },
  ])
})

test('an inverted or malformed range is rejected', () => {
  assert.throws(() => splitRange('2026-08-15', '2026-08-01'), /Invalid date range/)
  assert.throws(() => splitRange('nonsense', '2026-08-01'), /Invalid date range/)
})

// --- Error translation -----------------------------------------------------

test('an expired API version gets an actionable hint', () => {
  const err = explainMetaError(400, {
    error: { message: 'Unsupported get request. Object with ID does not exist', code: 803 },
  })
  assert.match(err.hint ?? '', /META_API_VERSION/)
})

test('an invalid token is identified by code, not by message text', () => {
  const err = explainMetaError(400, { error: { message: 'Error validating access token', code: 190 } })
  assert.match(err.hint ?? '', /token is invalid or expired/)
})

test('rate limiting is identified and explained', () => {
  const err = explainMetaError(429, { error: { message: 'User request limit reached', code: 17 } })
  assert.match(err.hint ?? '', /rate limiting/)
})

test('an unrecognised error still carries Meta’s own message', () => {
  const err = explainMetaError(500, { error: { message: 'Something odd happened', code: 1 } })
  assert.equal(err.message, 'Something odd happened')
  assert.equal(err.status, 500)
  assert.equal(err.hint, undefined)
})

test('a response with no error envelope still produces a usable error', () => {
  const err = explainMetaError(502, null)
  assert.match(err.message, /502/)
})
