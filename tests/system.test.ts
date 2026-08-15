import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { MODULES, ROUTES, TABLE_PURPOSE, VERIFICATION } from '../lib/commerce/system'

// The /ops/system page claims a specific set of files exists and says what each
// one does. Those claims are only worth anything if a rename or deletion breaks
// something. That is this file's entire job: the manifest is checked against the
// filesystem, so the page cannot quietly become a lie.

/** Walk up from the compiled test file until package.json is found. */
function repoRoot(): string {
  let dir = __dirname
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, 'package.json'))) return dir
    dir = path.dirname(dir)
  }
  throw new Error('Could not locate the repository root from ' + __dirname)
}

const ROOT = repoRoot()

function assertRealFile(rel: string, label: string) {
  const abs = path.join(ROOT, rel)
  assert.ok(existsSync(abs), `${label} points at ${rel}, which does not exist`)
  assert.ok(statSync(abs).isFile(), `${label} points at ${rel}, which is not a file`)
}

test('every module in the manifest exists on disk', () => {
  for (const m of MODULES) assertRealFile(m.file, `Module "${m.name}"`)
})

test('every route in the manifest has a real route file', () => {
  for (const r of ROUTES) assertRealFile(r.file, `Route "${r.path}"`)
})

test('every test file named on the verification list exists', () => {
  for (const v of VERIFICATION) assertRealFile(v.file, `Verification entry "${v.area}"`)
})

test('the page that renders the manifest is itself in the manifest', () => {
  assert.ok(
    ROUTES.some((r) => r.file === 'app/ops/system/page.tsx'),
    'The system page must list itself, or the inventory is incomplete by one'
  )
  assert.ok(
    MODULES.some((m) => m.file === 'lib/commerce/system.ts'),
    'The manifest module must list itself'
  )
  assert.ok(
    VERIFICATION.some((v) => v.file === 'tests/system.test.ts'),
    'This test must be listed, since it is what makes the page trustworthy'
  )
})

test('manifest entries are unique', () => {
  const moduleFiles = MODULES.map((m) => m.file)
  assert.equal(new Set(moduleFiles).size, moduleFiles.length, 'duplicate module file')

  const routePaths = ROUTES.map((r) => r.path)
  assert.equal(new Set(routePaths).size, routePaths.length, 'duplicate route path')

  const routeFiles = ROUTES.map((r) => r.file)
  assert.equal(new Set(routeFiles).size, routeFiles.length, 'duplicate route file')

  const tables = TABLE_PURPOSE.map((t) => t.table)
  assert.equal(new Set(tables).size, tables.length, 'duplicate table')
})

test('every route file is a Next.js route entry point', () => {
  for (const r of ROUTES) {
    const base = path.basename(r.file)
    assert.ok(
      base === 'page.tsx' || base === 'route.ts',
      `Route "${r.path}" points at ${base}, which Next does not treat as a route`
    )
  }
})

test('nothing is described as REAL without a purpose, and caveats are stated', () => {
  for (const m of MODULES) {
    assert.ok(m.purpose.trim().length > 20, `Module "${m.name}" needs a real description`)
    if (m.maturity === 'MOCK' || m.maturity === 'UNVERIFIED') {
      assert.ok(
        m.note && m.note.trim().length > 0,
        `Module "${m.name}" is ${m.maturity} and must say what that means for the operator`
      )
    }
  }
})

test('every table listed on the page has a purpose', () => {
  for (const t of TABLE_PURPOSE) {
    assert.ok(t.table.startsWith('ds_'), `${t.table} is outside the commerce namespace`)
    assert.ok(t.purpose.trim().length > 10, `${t.table} needs a description`)
  }
})
