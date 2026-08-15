import { config } from '@/lib/commerce/config'
import { listEvents, listRecommendations } from '@/lib/commerce/db/repo'
import { ActionButton } from '@/components/ops/ActionButton'
import { Badge, Card, Empty, Note, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

const DAILY = [
  'Check supplier inventory for every mapped variant, flag out-of-stock and low stock.',
  'Check supplier prices and flag any increase that erodes margin.',
  'Sweep orders needing attention and orders with no tracking after five days.',
  'Poll tracking for every submitted and fulfilled order, and email the customer on change.',
  'Send abandoned-cart reminders (once, at least an hour after abandonment).',
  'Compare 7-day ROAS per product against target and flag pause or scale candidates.',
]

const WEEKLY = [
  'Classify testing products as winner or loser candidates on 30-day ROAS and volume.',
  'Flag products with a refund rate above 8%.',
  'Flag products whose gross margin has fallen below 45%.',
  'Flag creative fatigue on winners whose ROAS has dropped below target.',
  'Queue the highest-scoring approved, never-advertised products as test candidates.',
]

export default async function OpsAutomations() {
  const [recommendations, events] = await Promise.all([
    listRecommendations('open'),
    listEvents(40),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Automations</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-600">
          Jobs produce recommendations. Nothing here changes a live product&apos;s price or status on
          its own — automating money-affecting changes without review is the wrong default.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Daily jobs">
          <ul className="space-y-1.5 text-sm text-ink-600">
            {DAILY.map((d) => (
              <li key={d} className="flex gap-2">
                <span aria-hidden className="text-ink-400">—</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <ActionButton
              url="/api/commerce/automations/run?which=daily"
              label="Run daily now"
              busyLabel="Running…"
              variant="primary"
              resultKind="automation-run"
            />
          </div>
        </Card>

        <Card title="Weekly review">
          <ul className="space-y-1.5 text-sm text-ink-600">
            {WEEKLY.map((d) => (
              <li key={d} className="flex gap-2">
                <span aria-hidden className="text-ink-400">—</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <ActionButton
              url="/api/commerce/automations/run?which=weekly"
              label="Run weekly now"
              busyLabel="Running…"
              resultKind="automation-run"
            />
          </div>
        </Card>

        <Card title="Scheduling">
          <p className="text-sm leading-relaxed text-ink-600">
            The runner is scheduler-agnostic. Point any cron at:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900 p-3 text-xs leading-relaxed text-sand-100">
{`POST /api/commerce/automations/run?which=daily
Authorization: Bearer $CRON_SECRET`}
          </pre>
          <div className="mt-3">
            <Badge tone={config.cronConfigured ? 'REAL' : 'TODO'}>
              {config.cronConfigured ? 'CRON_SECRET set' : 'CRON_SECRET not set'}
            </Badge>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Without the secret, jobs can still be run from this page by an allowlisted admin.
          </p>
        </Card>
      </div>

      <Card title={`Open recommendations (${recommendations.length})`}>
        {recommendations.length === 0 ? (
          <Empty title="Nothing open" body="Run a job above to generate recommendations from current data." />
        ) : (
          <ul className="space-y-3">
            {recommendations.map((r) => (
              <li key={r.id} className="rounded-xl border border-ink-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.severity}>{r.kind}</Badge>
                  <p className="text-[0.95rem] font-medium text-ink-900">{r.title}</p>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-600">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Event log">
        {events.length === 0 ? (
          <p className="text-sm text-ink-600">No events recorded yet.</p>
        ) : (
          <Table head={['When', 'Level', 'Kind', 'Message']}>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="py-2.5 pr-4 whitespace-nowrap text-ink-600">
                  {e.created_at.slice(0, 16).replace('T', ' ')}
                </td>
                <td className="py-2.5 pr-4">
                  <Badge tone={e.level === 'error' ? 'critical' : e.level === 'warn' ? 'warning' : 'info'}>
                    {e.level}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4 text-ink-700">{e.kind}</td>
                <td className="py-2.5 pr-4 text-ink-700">{e.message}</td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-4">
          <Note>
            Every order transition, supplier submission, webhook and automation run is recorded here.
            Failures are logged at error level and never swallowed.
          </Note>
        </div>
      </Card>
    </div>
  )
}
