import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ValidationError, Validator, escapeHtml, slugify } from '../lib/commerce/validate'

function expectIssues(fn: () => void): string[] {
  try {
    fn()
  } catch (err) {
    if (err instanceof ValidationError) return err.issues
    throw err
  }
  throw new Error('expected a ValidationError')
}

test('a non-object body is rejected', () => {
  const issues = expectIssues(() => new Validator('nope').done())
  assert.ok(issues[0].includes('JSON object'))
})

test('required strings and lengths are enforced', () => {
  const issues = expectIssues(() => {
    const v = new Validator({ name: '' })
    v.string('name', { required: true })
    v.string('slug', { min: 3 })
    v.done()
  })
  assert.ok(issues.some((i) => i.includes('name is required')))
})

test('email validation rejects malformed addresses', () => {
  const issues = expectIssues(() => {
    const v = new Validator({ email: 'not-an-email' })
    v.email('email')
    v.done()
  })
  assert.ok(issues.some((i) => i.includes('valid email')))

  const v = new Validator({ email: 'Person@Example.COM' })
  assert.equal(v.email('email'), 'person@example.com')
  v.done()
})

test('cart lines reject junk, enforce bounds, and cap line count', () => {
  const issues = expectIssues(() => {
    const v = new Validator({ lines: [{ variantId: '', qty: 1 }, { variantId: 'x', qty: 0 }] })
    v.cartLines('lines')
    v.done()
  })
  assert.equal(issues.length, 2)

  const tooMany = expectIssues(() => {
    const v = new Validator({ lines: Array.from({ length: 21 }, () => ({ variantId: 'x', qty: 1 })) })
    v.cartLines('lines')
    v.done()
  })
  assert.ok(tooMany[0].includes('at most 20'))

  const v = new Validator({ lines: [{ variantId: ' abc ', qty: '3' }] })
  assert.deepEqual(v.cartLines('lines'), [{ variantId: 'abc', qty: 3 }])
  v.done()
})

test('oneOf constrains to the allowed set', () => {
  const issues = expectIssues(() => {
    const v = new Validator({ status: 'sold' })
    v.oneOf('status', ['approved', 'rejected'] as const, { required: true })
    v.done()
  })
  assert.ok(issues[0].includes('must be one of'))
})

test('ints are rounded and bounded', () => {
  const v = new Validator({ qty: 3.6, price: -5 })
  assert.equal(v.int('qty'), 4)
  v.int('price', { min: 0 })
  const issues = expectIssues(() => v.done())
  assert.ok(issues.some((i) => i.includes('price must be at least 0')))
})

test('slugify produces clean, bounded URL segments', () => {
  assert.equal(slugify('Halo Bedside Light'), 'halo-bedside-light')
  assert.equal(slugify('  ¡Hola!  Café  '), 'hola-cafe')
  assert.equal(slugify('a'.repeat(200)).length, 80)
})

test('escapeHtml neutralises markup used in generated email', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
})
