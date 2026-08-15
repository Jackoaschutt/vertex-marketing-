import Link from 'next/link'
import { config } from '@/lib/commerce/config'
import { formatMoney, formatPercent, formatRatio } from '@/lib/commerce/money'
import { loadDashboard } from '@/lib/commerce/analytics/profit'
import { listOrders, listRecommendations } from '@/lib/commerce/db/repo'
import { SUGGESTED_QUESTIONS } from '@/lib/commerce/ai/analyst'
import { AnalystPanel } from '@/components/ops/AnalystPanel'
import { RevenueChart } from '@/components/ops/RevenueChart'
import { Badge, Card, Empty, Note, Stat, StatusBadge, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsOverview() {
  const [dashboard, attention, recommendations] = await Promise.all([
    loadDashboard(),
    listOrders({ status: 'needs_attention', limit: 10 }),
    listRecommendations('open'),
  ])

  const { today, week, month, allTime, productPnl, dailySeries } = dashboard
  const ranked = productPnl.filter((p) => p.orders > 0)
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  const currency = config.currency

  return (
    <div className="space-y-6">
      {attention.length > 0 && (
        <Note tone="warning">
          <strong>{attention.length} order(s) need attention.</strong>{' '}
          {attention[0].order_number}: {attention[0].attention_reason}{' '}
          <Link href="/ops/orders" className="underline underline-offset-4">
            Open orders
          </Link>
        </Note>
      )}

      {/* Today ----------------------------------------------------------- */}
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Today</h1>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Revenue" value={formatMoney(today.netRevenueCents, currency)} sub={`${today.orders} orders`} />
          <Stat
            label="Profit"
            value={formatMoney(today.netProfitCents, currency)}
            tone={today.netProfitCents >= 0 ? 'positive' : 'negative'}
            sub={`margin ${formatPercent(today.netMargin)}`}
          />
          <Stat label="Ad spend" value={formatMoney(today.adSpendCents, currency)} sub={`ROAS ${formatRatio(today.roas)}`} />
          <Stat label="AOV" value={today.aovCents === null ? '—' : formatMoney(today.aovCents, currency)} sub="today" />
        </div>
      </div>

      {/* Windows --------------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Week revenue" value={formatMoney(week.netRevenueCents, currency)} sub={`${week.orders} orders`} />
        <Stat
          label="Week profit"
          value={formatMoney(week.netProfitCents, currency)}
          tone={week.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`ROAS ${formatRatio(week.roas)} · CPA ${week.cpaCents === null ? '—' : formatMoney(week.cpaCents, currency)}`}
        />
        <Stat label="30-day revenue" value={formatMoney(month.netRevenueCents, currency)} sub={`${month.orders} orders`} />
        <Stat
          label="30-day profit"
          value={formatMoney(month.netProfitCents, currency)}
          tone={month.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`refunds ${formatPercent(month.refundRate)}`}
        />
      </div>

      <Card title="Last 30 days">
        <RevenueChart data={dailySeries} currency={currency} />
      </Card>

      {/* Best / worst ---------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Best product">
          {best ? (
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[1.05rem] font-medium text-ink-900">{best.product.name}</p>
                <StatusBadge status={best.product.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-600">Net profit</dt>
                <dd className="text-right tabular-nums text-moss-500">{formatMoney(best.netProfitCents, currency)}</dd>
                <dt className="text-ink-600">Revenue</dt>
                <dd className="text-right tabular-nums text-ink-900">{formatMoney(best.revenueCents, currency)}</dd>
                <dt className="text-ink-600">ROAS</dt>
                <dd className="text-right tabular-nums text-ink-900">{formatRatio(best.roas)}</dd>
                <dt className="text-ink-600">Orders</dt>
                <dd className="text-right tabular-nums text-ink-900">{best.orders}</dd>
              </dl>
            </div>
          ) : (
            <Empty title="No sales yet" body="Product performance appears here after the first order." />
          )}
        </Card>

        <Card title="Worst product">
          {worst && worst !== best ? (
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[1.05rem] font-medium text-ink-900">{worst.product.name}</p>
                <StatusBadge status={worst.product.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-600">Net profit</dt>
                <dd className={`text-right tabular-nums ${worst.netProfitCents < 0 ? 'text-clay-600' : 'text-ink-900'}`}>
                  {formatMoney(worst.netProfitCents, currency)}
                </dd>
                <dt className="text-ink-600">Ad spend</dt>
                <dd className="text-right tabular-nums text-ink-900">{formatMoney(worst.adSpendCents, currency)}</dd>
                <dt className="text-ink-600">ROAS</dt>
                <dd className="text-right tabular-nums text-ink-900">{formatRatio(worst.roas)}</dd>
                <dt className="text-ink-600">Orders</dt>
                <dd className="text-right tabular-nums text-ink-900">{worst.orders}</dd>
              </dl>
            </div>
          ) : (
            <Empty title="Not enough products" body="A second selling product is needed before a comparison means anything." />
          )}
        </Card>
      </div>

      {/* Analyst --------------------------------------------------------- */}
      <Card
        title="AI analyst"
        action={<Badge tone={config.anthropicConfigured ? 'REAL' : 'MOCK'}>{config.anthropicConfigured ? 'model' : 'rules fallback'}</Badge>}
      >
        <AnalystPanel suggestions={SUGGESTED_QUESTIONS} />
      </Card>

      {/* Recommendations -------------------------------------------------- */}
      <Card
        title="Recommendations"
        action={
          <Link href="/ops/automations" className="text-xs text-ink-600 underline underline-offset-4">
            Run automations
          </Link>
        }
      >
        {recommendations.length === 0 ? (
          <Empty
            title="No open recommendations"
            body="Run the daily or weekly automation jobs to generate them from current data."
            href="/ops/automations"
            cta="Go to automations"
          />
        ) : (
          <ul className="space-y-3">
            {recommendations.slice(0, 8).map((r) => (
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

      {/* All-time -------------------------------------------------------- */}
      <Card title="All time">
        <Table head={['Metric', 'Value']}>
          {[
            ['Gross revenue', formatMoney(allTime.grossRevenueCents, currency)],
            ['Refunds', formatMoney(allTime.refundsCents, currency)],
            ['Net revenue', formatMoney(allTime.netRevenueCents, currency)],
            ['Cost of goods', formatMoney(allTime.cogsCents, currency)],
            ['Gross profit', formatMoney(allTime.grossProfitCents, currency)],
            ['Payment fees', formatMoney(allTime.paymentFeesCents, currency)],
            ['Ad spend', formatMoney(allTime.adSpendCents, currency)],
            ['Other expenses', formatMoney(allTime.otherExpensesCents, currency)],
            ['Net profit', formatMoney(allTime.netProfitCents, currency)],
            ['Net margin', formatPercent(allTime.netMargin)],
            ['Orders', String(allTime.orders)],
            ['Units', String(allTime.units)],
            ['AOV', allTime.aovCents === null ? '—' : formatMoney(allTime.aovCents, currency)],
            ['ROAS', formatRatio(allTime.roas)],
            ['CPA', allTime.cpaCents === null ? '—' : formatMoney(allTime.cpaCents, currency)],
            ['Conversion rate', formatPercent(allTime.conversionRate)],
            ['Refund rate', formatPercent(allTime.refundRate)],
          ].map(([k, val]) => (
            <tr key={k}>
              <td className="py-2 pr-4 text-ink-600">{k}</td>
              <td className="py-2 pr-4 tabular-nums text-ink-900">{val}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Revenue is not profit. Net profit above is net revenue minus cost of goods, payment fees,
          ad spend and other expenses. A dash means the metric could not be computed from the data
          available — it is never shown as zero.
        </p>
      </Card>
    </div>
  )
}
