import { config } from '@/lib/commerce/config'
import { formatMoney, formatPercent, formatRatio } from '@/lib/commerce/money'
import { loadDashboard } from '@/lib/commerce/analytics/profit'
import { rollupByChannel } from '@/lib/commerce/analytics/attribution'
import { listOrders } from '@/lib/commerce/db/repo'
import { Card, Empty, Note, StatusBadge, Table } from '@/components/ops/ui'
import { RevenueChart } from '@/components/ops/RevenueChart'

export const dynamic = 'force-dynamic'

export default async function OpsAnalytics() {
  const [dashboard, orders] = await Promise.all([loadDashboard(), listOrders({ limit: 2000 })])
  const { productPnl, dailySeries, allTime } = dashboard
  const channels = rollupByChannel(orders)
  const currency = config.currency

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Analytics</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-600">
          Every figure is computed from stored integer cents. A dash means the metric could not be
          computed — it is never rendered as zero.
        </p>
      </div>

      <Card title="Revenue, profit and ad spend — 30 days">
        <RevenueChart data={dailySeries} currency={currency} />
      </Card>

      <Card title="Profit and loss (all time)">
        <Table head={['Line', 'Amount']}>
          {[
            ['Gross revenue', allTime.grossRevenueCents],
            ['Less discounts', -allTime.discountsCents],
            ['Less refunds', -allTime.refundsCents],
            ['Net revenue', allTime.netRevenueCents],
            ['Less cost of goods', -allTime.cogsCents],
            ['Gross profit', allTime.grossProfitCents],
            ['Less payment fees', -allTime.paymentFeesCents],
            ['Less advertising', -allTime.adSpendCents],
            ['Less other expenses', -allTime.otherExpensesCents],
            ['Net profit', allTime.netProfitCents],
          ].map(([label, amount], i, arr) => (
            <tr key={label as string} className={i === arr.length - 1 ? 'font-medium' : ''}>
              <td className="py-2 pr-4 text-ink-700">{label as string}</td>
              <td
                className={`py-2 pr-4 tabular-nums ${
                  (amount as number) < 0 ? 'text-clay-600' : 'text-ink-900'
                }`}
              >
                {formatMoney(amount as number, currency)}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Per-product contribution">
        {productPnl.length === 0 ? (
          <Empty title="No product data" body="Per-product P&L appears once orders exist." />
        ) : (
          <Table
            head={['Product', 'Status', 'Orders', 'Revenue', 'COGS', 'Gross', 'Ad spend', 'Net', 'ROAS', 'CPA', 'Refunds']}
          >
            {productPnl.map((p) => (
              <tr key={p.product.id}>
                <td className="py-2.5 pr-4 text-ink-900">{p.product.name}</td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={p.product.status} />
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{p.orders}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(p.revenueCents, currency)}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-600">{formatMoney(p.cogsCents, currency)}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(p.grossProfitCents, currency)}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-600">{formatMoney(p.adSpendCents, currency)}</td>
                <td
                  className={`py-2.5 pr-4 tabular-nums ${p.netProfitCents < 0 ? 'text-clay-600' : 'text-moss-500'}`}
                >
                  {formatMoney(p.netProfitCents, currency)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatRatio(p.roas)}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                  {p.cpaCents === null ? '—' : formatMoney(p.cpaCents, currency)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatPercent(p.refundRate, 0)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Orders by attributed source">
        {channels.length === 0 ? (
          <Empty title="No attribution data" body="Attribution is captured from UTM parameters and click ids on the landing page." />
        ) : (
          <Table head={['Source', 'Orders', 'Revenue', 'AOV', 'Share of orders']}>
            {channels.map((c) => (
              <tr key={c.source}>
                <td className="py-2.5 pr-4 text-ink-900">{c.source}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{c.orders}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(c.revenueCents, currency)}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                  {c.aovCents === null ? '—' : formatMoney(c.aovCents, currency)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatPercent(c.share, 0)}</td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-4">
          <Note>
            This is last non-direct click attribution from a first-party cookie. It cannot see
            view-through conversions or cross-device journeys, so paid-social contribution is
            understated here relative to what an ad platform will claim. Page-level funnel drop-off
            is not measured at all — no analytics provider is connected.
          </Note>
        </div>
      </Card>
    </div>
  )
}
