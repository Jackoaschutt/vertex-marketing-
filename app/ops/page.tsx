import Link from 'next/link'
import { formatMoney, formatPercent, formatRatio } from '@/lib/commerce/money'
import { loadDashboard } from '@/lib/commerce/analytics/profit'
import { listEvents, listPostmortems, listRecommendations } from '@/lib/commerce/db/repo'
import { CHECKLISTS, stageForStatus } from '@/lib/commerce/research/checklist'
import { AnalystPanel } from '@/components/ops/AnalystPanel'
import { RevenueChart } from '@/components/ops/RevenueChart'
import { Badge, Card, Empty, Note, Stat, StatusBadge, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsOverview() {
  const [dashboard, recommendations, postmortems, events] = await Promise.all([
    loadDashboard(),
    listRecommendations('open'),
    listPostmortems(),
    listEvents(8),
  ])

  const { today, week, month, allTime, productPnl } = dashboard
  const active = productPnl.filter(
    (p) => p.product.status === 'testing' || p.product.status === 'scaling'
  )
  const best = productPnl[0]
  const worst = [...productPnl].reverse().find((p) => p.summary.netProfitCents < 0)
  const critical = recommendations.filter((r) => r.severity === 'critical')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Overview</h1>
        <p className="mt-1 text-sm text-ink-600">
          Where the money actually is, and what needs a decision.
        </p>
      </div>

      {!dashboard.hasAnyData && (
        <Note>
          <strong>Nothing has been entered yet.</strong> Every figure below is zero because the
          ledger is empty, not because nothing sold. Start in{' '}
          <Link href="/ops/books" className="underline">
            Books
          </Link>{' '}
          — or in{' '}
          <Link href="/ops/research" className="underline">
            Research
          </Link>{' '}
          if you are still looking for the first product.
        </Note>
      )}

      {critical.length > 0 && (
        <Note tone="warning">
          <strong>
            {critical.length} thing{critical.length === 1 ? '' : 's'} need
            {critical.length === 1 ? 's' : ''} your attention.
          </strong>{' '}
          {critical[0].title}
          {critical.length > 1 ? ` (and ${critical.length - 1} more)` : ''} —{' '}
          <Link href="/ops/automations" className="underline">
            see all
          </Link>
          .
        </Note>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Today"
          value={formatMoney(today.netProfitCents)}
          tone={today.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`${formatMoney(today.revenueCents)} revenue`}
        />
        <Stat
          label="Last 7 days"
          value={formatMoney(week.netProfitCents)}
          tone={week.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`ROAS ${formatRatio(week.roas)}`}
        />
        <Stat
          label="Last 30 days"
          value={formatMoney(month.netProfitCents)}
          tone={month.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`${formatMoney(month.adSpendCents)} on ads`}
        />
        <Stat
          label="All time"
          value={formatMoney(allTime.netProfitCents)}
          tone={allTime.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`Net margin ${formatPercent(allTime.netMargin)}`}
        />
      </div>

      <Card title="Revenue, ad spend and net profit — 30 days">
        <RevenueChart data={dashboard.series} />
        {dashboard.unattributedAdSpendCents > 0 && (
          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            {formatMoney(dashboard.unattributedAdSpendCents)} of ad spend is not attached to any
            product. It is included in these totals but not in any per-product figure below, which
            is why the parts will not add up to the whole.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Best and worst">
          {productPnl.length === 0 ? (
            <Empty title="No products yet" body="Add your first candidate in Research." href="/ops/research" cta="Go to Research" />
          ) : (
            <div className="space-y-4">
              {best && (
                <div className="rounded-xl border border-ink-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="positive">Best</Badge>
                    <p className="font-medium text-ink-900">{best.product.name}</p>
                    <StatusBadge status={best.product.status} />
                  </div>
                  <p className="mt-1.5 text-sm text-ink-600">
                    {formatMoney(best.summary.netProfitCents)} net on{' '}
                    {formatMoney(best.summary.revenueCents)} revenue, ROAS{' '}
                    {formatRatio(best.summary.roas)}.
                  </p>
                </div>
              )}
              {worst ? (
                <div className="rounded-xl border border-clay-500/40 bg-clay-400/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">Losing money</Badge>
                    <p className="font-medium text-ink-900">{worst.product.name}</p>
                    <StatusBadge status={worst.product.status} />
                  </div>
                  <p className="mt-1.5 text-sm text-ink-600">
                    {formatMoney(worst.summary.netProfitCents)} net after{' '}
                    {formatMoney(worst.summary.adSpendCents)} of ad spend.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-600">Nothing is currently net-negative.</p>
              )}
            </div>
          )}
        </Card>

        <Card title="In progress">
          {active.length === 0 ? (
            <Empty
              title="Nothing under test"
              body="Products at testing or scaling appear here with their live numbers."
              href="/ops/products"
              cta="See the pipeline"
            />
          ) : (
            <Table head={['Product', 'Stage', 'Net', 'ROAS']}>
              {active.map(({ product, summary }) => {
                const stage = stageForStatus(product.status)
                return (
                  <tr key={product.id}>
                    <td className="py-2.5 pr-4">
                      <Link href={`/ops/products/${product.id}`} className="text-ink-900 underline decoration-ink-300">
                        {product.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-ink-600">
                      {stage ? `${stage} · ${CHECKLISTS[stage].length} steps` : '—'}
                    </td>
                    <td
                      className={`py-2.5 pr-4 tabular-nums ${
                        summary.netProfitCents >= 0 ? 'text-moss-500' : 'text-clay-600'
                      }`}
                    >
                      {formatMoney(summary.netProfitCents)}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-ink-700">
                      {formatRatio(summary.roas)}
                    </td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Ask the coach">
        <AnalystPanel
          suggestions={[
            'Which product is actually making money after ad spend?',
            'What do my losers have in common?',
            'Is anything worth more budget right now?',
            'What should I check before I test the next product?',
          ]}
        />
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Answers are computed from your ledger and your own post-mortems ({postmortems.length}{' '}
          written) before the question is asked. It is instructed to say what is missing rather than
          estimate.
        </p>
      </Card>

      {events.length > 0 && (
        <Card title="Recent activity">
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="tabular-nums text-ink-500">
                  {new Date(e.created_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className={e.level === 'error' ? 'text-clay-600' : 'text-ink-700'}>
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
