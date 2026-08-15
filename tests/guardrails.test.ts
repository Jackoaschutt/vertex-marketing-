import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sanitize, scanContent } from '../lib/commerce/ai/guardrails'

test('fabricated statistics are caught', () => {
  const issues = scanContent({ body: 'Users report 43% more deep sleep within a week.' })
  assert.ok(issues.length > 0)
})

test('clinical and study claims are caught', () => {
  assert.ok(scanContent('Clinically proven to help you drift off.').length > 0)
  assert.ok(scanContent('Studies show it works.').length > 0)
  assert.ok(scanContent('Research shows a marked improvement.').length > 0)
})

test('medical and regulatory claims are caught', () => {
  assert.ok(scanContent('It treats insomnia.').length > 0)
  assert.ok(scanContent('FDA approved.').length > 0)
  assert.ok(scanContent('Medical grade materials.').length > 0)
})

test('invented social proof is caught', () => {
  assert.ok(scanContent('Loved by 12,000 happy customers.').length > 0)
  assert.ok(scanContent('Rated 4.8/5 by our community.').length > 0)
})

test('false scarcity and unbacked guarantees are caught', () => {
  assert.ok(scanContent('Only 3 left — hurry!').length > 0)
  assert.ok(scanContent('Selling fast, ends tonight.').length > 0)
  assert.ok(scanContent('100% satisfaction guarantee.').length > 0)
  assert.ok(scanContent('Try it risk-free.').length > 0)
})

test('award and ranking claims are caught', () => {
  assert.ok(scanContent('Our award-winning bedside light.').length > 0)
  assert.ok(scanContent('The #1 sleep mask.').length > 0)
})

test('honest, specific copy passes cleanly', () => {
  const copy = {
    title: 'Halo Bedside Light',
    description:
      'Overhead lights are too bright to read by at 11pm. Halo dims steplessly down to a low warm glow, so one person can read while the other sleeps. It runs from USB-C and holds its setting between uses.',
    faq: [
      {
        question: 'How long does delivery take?',
        answer: 'Typically 6 to 11 business days, with tracking emailed on dispatch.',
      },
    ],
  }
  assert.deepEqual(scanContent(copy), [])
  assert.equal(sanitize(copy).clean, true)
})

test('sanitize strips the offending string and leaves the rest intact', () => {
  const input = {
    title: 'Halo Bedside Light',
    benefits: [
      { heading: 'Reads warm', body: 'Dims to a low warm glow.' },
      { heading: 'Proven', body: 'Clinically proven to improve sleep.' },
    ],
  }
  const result = sanitize(input)
  assert.equal(result.clean, false)
  assert.equal(result.issues.length > 0, true)
  assert.equal(result.value.title, 'Halo Bedside Light')
  assert.equal(result.value.benefits[0].body, 'Dims to a low warm glow.')
  assert.equal(result.value.benefits[1].body, '')
})

test('nested structures are walked completely', () => {
  const deep = { a: { b: { c: ['fine', 'Only 2 left in stock!'] } } }
  const issues = scanContent(deep)
  assert.equal(issues.length, 1)
  assert.ok(issues[0].field.includes('a.b.c'))
})
