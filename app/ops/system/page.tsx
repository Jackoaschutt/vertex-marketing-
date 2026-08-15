import Link from 'next/link'
import { brand } from '@/lib/commerce/brand'
import {
  buildSnapshot,
  MODULES,
  ROUTES,
  VERIFICATION,
  type Maturity,
  type ModuleEntry,
  type RouteEntry,
} from '@/lib/commerce/system'
import { Badge, Card, Note, Stat, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

const MATURITY_TONE: Record<Maturity, string> = {
  REAL: 'REAL',
  MOCK: 'MOCK',
  TODO: 'TODO',
  UNVERIFIED: 'warning',
}

const MATURITY_MEANING: { key: Maturity; meaning: string }[] = [
  { key: 'REAL', meaning: 'Written, wired up and exercised. Works when its credentials are present.' },
  { key: 'UNVERIFIED', meaning: 'Real code against a real API, but never run against a live account. Treat as untested until you do.' },
  { key: 'MOCK', meaning: 'Deliberately simulated. Labelled everywhere it appears so it can never be mistaken for the real thing.' },
  { key: 'TODO', meaning: 'Interface exists, implementation does not.' },
]

const GROUPS: { heading: string; blurb: string; match: (m: ModuleEntry) => boolean }[] = [
  { heading: 'Foundation', blurb: 'Brand, money, validation, auth, SEO.', match: (m) => /^lib\/commerce\/[^/]+\.ts$/.test(m.file) && m.file !== 'lib/commerce/cart.ts' && m.file !== 'lib/commerce/system.ts' },
  { heading: 'Data', blurb: 'One storage contract, two drivers, one repository layer.', match: (m) => m.file.startsWith('lib/commerce/db/') },
  { heading: 'Research', blurb: 'The 100-point rubric and the product lifecycle.', match: (m) => m.file.startsWith('lib/commerce/research/') },
  { heading: 'Suppliers', blurb: 'Swappable adapters behind one interface.', match: (m) => m.file.startsWith('lib/commerce/suppliers/') },
  { heading: 'Orders', blurb: 'Cart pricing through to tracking.', match: (m) => m.file.startsWith('lib/commerce/orders/') || m.file === 'lib/commerce/cart.ts' },
  { heading: 'Analytics', blurb: 'Profit, not revenue.', match: (m) => m.file.startsWith('lib/commerce/analytics/') },
  { heading: 'Marketing', blurb: 'Ad channels, spend import, attribution.', match: (m) => m.file.startsWith('lib/commerce/marketing/') },
  { heading: 'AI', blurb: 'Generation with a truthfulness filter on the way out.', match: (m) => m.file.startsWith('lib/commerce/ai/') },
  { heading: 'Automation & email', blurb: 'Scheduled jobs and the nine lifecycle emails.', match: (m) => m.file.startsWith('lib/commerce/automation/') || m.file.startsWith('lib/commerce/email/') },
  { heading: 'This page', blurb: 'The inventory itself.', match: (m) => m.file === 'lib/commerce/system.ts' },
]

const ROUTE_KINDS: { kind: RouteEntry['kind']; heading: string; blurb: string }[] = [
  { kind: 'storefront', heading: 'Storefront', blurb: 'Public, indexable, mobile-first.' },
  { kind: 'generated', heading: 'Generated files', blurb: 'Built from live data on request.' },
  { kind: 'admin', heading: 'Admin', blurb: 'Allowlist-gated and never indexed.' },
  { kind: 'api', heading: 'API', blurb: 'Each one states who is allowed to call it.' },
]

function when(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function OpsSystem() {
  const snap = await buildSnapshot()
  const grouped = GROUPS.map((g) => ({ ...g, modules: MODULES.filter(g.match) })).filter(
    (g) => g.modules.length > 0
  )
  const ungrouped = MODULES.filter((m) => !grouped.some((g) => g.modules.includes(m)))
  const unverified = MODULES.filter((m) => m.maturity === 'UNVERIFIED')
  const mocked = MODULES.filter((m) => m.maturity === 'MOCK')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">System</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
          Everything built for {brand.name}, what each part actually does, and whether it is real
          code, a labelled mock, or written-but-never-run. Configuration and counts are read live on
          every request, so this page cannot drift from the deployment you are looking at.
        </p>
      </div>

      {snap.blockingCount > 0 && (
        <Note tone="warning">
          <strong>Not ready to take real money.</strong> {snap.blockingCount} of the six required
          steps below are outstanding. The build is complete; the connections are not.
        </Note>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Modules" value={String(snap.totals.modules)} sub="Library files with a stated purpose" />
        <Stat label="Routes" value={String(snap.totals.routes)} sub="Pages, API endpoints, generated files" />
        <Stat label="Tables" value={String(snap.totals.tables)} sub="All prefixed ds_" />
        <Stat
          label="Launch readiness"
          value={`${snap.readyCount}/${snap.readiness.length}`}
          sub={snap.blockingCount === 0 ? 'No blocking items left' : `${snap.blockingCount} blocking`}
          tone={snap.blockingCount === 0 ? 'positive' : 'negative'}
        />
      </div>

      <Card title="Launch readiness">
        <ul className="space-y-2.5">
          {snap.readiness.map((r) => (
            <li key={r.label} className="flex gap-3 rounded-xl border border-ink-200 p-3.5">
              <span
                aria-hidden
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${
                  r.ready
                    ? 'bg-moss-400/20 text-moss-500'
                    : r.blocking
                      ? 'bg-danger-500/15 text-danger-600'
                      : 'bg-ink-200 text-ink-600'
                }`}
              >
                {r.ready ? '✓' : r.blocking ? '!' : '–'}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[0.95rem] font-medium text-ink-900">
                  {r.label}
                  <span className="sr-only">{r.ready ? 'ready' : 'not ready'}</span>
                  {!r.ready && !r.blocking && <Badge tone="info">optional</Badge>}
                  {!r.ready && r.blocking && <Badge tone="critical">required</Badge>}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{r.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Read from environment and database at {when(snap.generatedAt)}. Reload to re-check.
        </p>
      </Card>

      <Card title="What the labels mean">
        <dl className="space-y-2.5">
          {MATURITY_MEANING.map((m) => (
            <div key={m.key} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <dt className="shrink-0 sm:w-32">
                <Badge tone={MATURITY_TONE[m.key]}>{m.key}</Badge>
              </dt>
              <dd className="text-sm leading-relaxed text-ink-600">{m.meaning}</dd>
            </div>
          ))}
        </dl>
        {(unverified.length > 0 || mocked.length > 0) && (
          <p className="mt-4 border-t border-ink-100 pt-4 text-sm leading-relaxed text-ink-600">
            Right now {unverified.length} module(s) are UNVERIFIED (
            {unverified.map((m) => m.name).join(', ')}) and {mocked.length} are MOCK (
            {mocked.map((m) => m.name).join(', ')}). Nothing else is pretending.
          </p>
        )}
      </Card>

      <Card title="Integrations">
        <div className="space-y-3">
          {snap.capabilities.map((c) => (
            <div key={c.key} className="rounded-xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={c.configured ? 'REAL' : c.status}>
                  {c.configured ? 'REAL' : c.status}
                </Badge>
                <p className="font-medium text-ink-900">{c.label}</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{c.note}</p>
              {c.requires.length > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                  <span>Needs:</span>
                  {c.requires.map((r) => (
                    <code key={r} className="rounded bg-ink-100 px-1">
                      {r}
                    </code>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Every variable is documented in <code>.env.example</code>. No key is ever read in browser
          code.
        </p>
      </Card>

      <Card title={`Modules (${MODULES.length})`}>
        <div className="space-y-6">
          {[...grouped, ...(ungrouped.length ? [{ heading: 'Other', blurb: '', modules: ungrouped }] : [])].map(
            (group) => (
              <div key={group.heading}>
                <h3 className="text-[0.95rem] font-medium text-ink-900">{group.heading}</h3>
                {group.blurb && <p className="mt-0.5 text-xs text-ink-500">{group.blurb}</p>}
                <ul className="mt-3 space-y-2.5">
                  {group.modules.map((m) => (
                    <li key={m.file} className="rounded-xl border border-ink-200 p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={MATURITY_TONE[m.maturity]}>{m.maturity}</Badge>
                        <p className="font-medium text-ink-900">{m.name}</p>
                        <code className="break-all text-xs text-ink-500">{m.file}</code>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{m.purpose}</p>
                      {m.note && (
                        <p className="mt-1 text-sm leading-relaxed text-clay-600">{m.note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      </Card>

      <Card title={`Routes (${ROUTES.length})`}>
        <div className="space-y-6">
          {ROUTE_KINDS.map((k) => {
            const rows = ROUTES.filter((r) => r.kind === k.kind)
            if (rows.length === 0) return null
            return (
              <div key={k.kind}>
                <h3 className="text-[0.95rem] font-medium text-ink-900">
                  {k.heading} <span className="text-ink-500">({rows.length})</span>
                </h3>
                <p className="mt-0.5 text-xs text-ink-500">{k.blurb}</p>
                <div className="mt-3">
                  <Table head={['Path', 'Access', 'What it does', 'File']}>
                    {rows.map((r) => (
                      <tr key={r.path} className="align-top">
                        <td className="py-2.5 pr-4">
                          {r.auth === 'public' && k.kind !== 'api' ? (
                            <Link
                              href={r.path.includes('[') ? '/store/shop' : r.path}
                              className="text-ink-900 underline decoration-ink-300 underline-offset-2"
                            >
                              <code>{r.path}</code>
                            </Link>
                          ) : k.kind === 'admin' ? (
                            <Link
                              href={r.path}
                              className="text-ink-900 underline decoration-ink-300 underline-offset-2"
                            >
                              <code>{r.path}</code>
                            </Link>
                          ) : (
                            <code className="text-ink-900">{r.path}</code>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-ink-600">{r.auth}</td>
                        <td className="py-2.5 pr-4 text-ink-600">{r.purpose}</td>
                        <td className="py-2.5 pr-4">
                          <code className="text-xs text-ink-500">{r.file}</code>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Database">
        <Table head={['Table', 'Rows', 'What it holds']}>
          {snap.tables.map((t) => (
            <tr key={t.table} className="align-top">
              <td className="py-2.5 pr-4">
                <code className="text-ink-900">{t.table}</code>
              </td>
              <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                {t.rows === null ? <span className="text-ink-500">unknown</span> : t.rows}
              </td>
              <td className="py-2.5 pr-4 text-ink-600">{t.purpose}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          {snap.demoMode
            ? 'These counts come from the seeded in-memory demo store, not a database.'
            : 'Live counts from Postgres.'}{' '}
          Schema: <code>supabase/migrations/011_commerce_core.sql</code>. Row-level security is on
          with no policies, so nothing reaches these tables except the server using the service-role
          key.
        </p>
      </Card>

      <Card title="Operational state">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Products"
            value={String(snap.totals.products)}
            sub={`${snap.totals.publishedProducts} published`}
          />
          <Stat
            label="Open recommendations"
            value={String(snap.openRecommendations)}
            sub="Awaiting an operator decision"
          />
          <Stat
            label="Last automation run"
            value={snap.lastAutomationRun ? when(snap.lastAutomationRun.created_at) : 'Never'}
            sub={snap.lastAutomationRun?.message ?? 'Run one from /ops/automations'}
          />
        </div>
        {snap.recentErrors.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[0.95rem] font-medium text-ink-900">
              Recent errors ({snap.recentErrors.length})
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Failures are recorded rather than swallowed. Shown here so they cannot pass unnoticed.
            </p>
            <ul className="mt-3 space-y-2">
              {snap.recentErrors.map((e) => (
                <li key={e.id} className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <code>{e.kind}</code>
                    <span>{when(e.created_at)}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-700">{e.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Verification">
        <p className="text-sm leading-relaxed text-ink-600">
          What is actually covered by automated tests, run with <code>npm run test</code>. This is a
          list of test files, not a claim of correctness — anything not listed here is unproven.
        </p>
        <div className="mt-4">
          <Table head={['Area', 'Covers', 'File']}>
            {VERIFICATION.map((v) => (
              <tr key={v.file} className="align-top">
                <td className="py-2.5 pr-4 text-ink-900">{v.area}</td>
                <td className="py-2.5 pr-4 text-ink-600">{v.covers}</td>
                <td className="py-2.5 pr-4">
                  <code className="text-xs text-ink-500">{v.file}</code>
                </td>
              </tr>
            ))}
          </Table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Every file path on this page is asserted to exist by <code>tests/system.test.ts</code>, so
          a renamed or deleted module breaks the test suite instead of quietly leaving a false entry
          here.
        </p>
      </Card>

      <Card title="Documentation">
        <ul className="space-y-2 text-sm text-ink-600">
          <li>
            <code className="text-ink-900">docs/ARCHITECTURE.md</code> — why the system is shaped
            this way, including the audit of what was already in this repository.
          </li>
          <li>
            <code className="text-ink-900">docs/ROADMAP.md</code> — the eight phases, each item
            marked DONE, PARTIAL, TODO or BLOCKED.
          </li>
          <li>
            <code className="text-ink-900">docs/RUNBOOK.md</code> — how to run it, connect each
            integration, and what to check before launch.
          </li>
          <li>
            <code className="text-ink-900">.env.example</code> — every environment variable, what it
            unlocks, and what happens without it.
          </li>
        </ul>
      </Card>
    </div>
  )
}
