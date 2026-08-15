import { formatMoney, formatPercent, formatRatio } from '@/lib/commerce/money'
import { computeProfit, daysAgoIso, loadDashboard } from '@/lib/commerce/analytics/profit'
import { listExpenses, listSales } from '@/lib/commerce/db/repo'
import { Card, Empty, Note, Stat, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsAnalytics() {
  const [dashboard, sales, expenses] = await Promise.all([
    loadDashboard(),
    listSales(),
    listExpenses(),
  ])

  // Revenue by the channel it was entered against.
  const byChannel = new Map<string, { units: number; revenueCents: number; cogsCents: number }>()
  for (const s of sales) {
    const c = byChannel.get(s.channel) ?? { units: 0, revenueCents: 0, cogsCents: 0 }
    c.units += s.units
    c.revenueCents += s.revenue_cents - s.refunds_cents
    c.cogsCents += s.cogs_cents + s.shipping_cost_cents
    byChannel.set(s.channel, c)
  }
  const channels = [...byChannel.entries()].sort((a, b) => b[1].revenueCents - a[1].revenueCents)
  const totalRevenue = channels.reduce((sum, [, c]) => sum + c.revenueCents, 0)

  // Expense categories, since these are the costs people forget.
  const byCategory = new Map<string, number>()
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount_cents)
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1])

  const last90 = computeProfit({
    sales: sales.filter((s) => s.day >= daysAgoIso(89)),
    adMetrics: [],
    expenses: [],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Analytics</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
          Where the money came from and where it went. Every number here is computed from the
          ledger at the moment you loaded the page.
        </p>
      </div>

      {!dashboard.hasAnyData && (
        <Note>
          Nothing has been entered yet, so everything below is empty rather than zero. Start in
          Books.
        </Note>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="All-time revenue"
          value={formatMoney(dashboard.allTime.revenueCents)}
          sub={`${dashboard.allTime.units} unit(s)`}
        />
        <Stat
          label="All-time net"
          value={formatMoney(dashboard.allTime.netProfitCents)}
          tone={dashboard.allTime.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`Margin ${formatPercent(dashboard.allTime.netMargin)}`}
        />
        <Stat
          label="Gross margin"
          value={formatPercent(dashboard.allTime.grossMargin)}
          sub="Before ads and overheads"
        />
        <Stat
          label="Refund rate"
          value={formatPercent(dashboard.allTime.refundRate)}
          sub={`${dashboard.allTime.refundUnits} unit(s) refunded`}
        />
      </div>

      <Card title="Per-product contribution">
        {dashboard.productPnl.length === 0 ? (
          <Empty title="No products" body="Add candidates in Research first." />
        ) : (
          <>
            <Table head={['Product', 'Units', 'Revenue', 'COGS', 'Gross', 'Ads', 'Net', 'ROAS']}>
              {dashboard.productPnl.map(({ product, summary }) => (
                <tr key={product.id}>
                  <td className="py-2.5 pr-4 text-ink-900">{product.name}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-700">{summary.units}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                    {formatMoney(summary.revenueCents)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-600">
                    {formatMoney(summary.cogsCents)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-700">
                    {formatMoney(summary.grossProfitCents)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-600">
                    {formatMoney(summary.adSpendCents)}
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
              ))}
            </Table>
            {dashboard.unattributedAdSpendCents > 0 && (
              <p className="mt-4 text-xs leading-relaxed text-clay-600">
                {formatMoney(dashboard.unattributedAdSpendCents)} of ad spend has no product
                attached, so these rows do not sum to the whole-business net. That is reported
                rather than spread evenly, because spreading it would invent a number.
              </p>
            )}
          </>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By channel">
          {channels.length === 0 ? (
            <p className="text-sm text-ink-600">No sales entered yet.</p>
          ) : (
            <Table head={['Channel', 'Units', 'Revenue', 'Share']}>
              {channels.map(([channel, c]) => (
                <tr key={channel}>
                  <td className="py-2.5 pr-4 text-ink-900">{channel}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-700">{c.units}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                    {formatMoney(c.revenueCents)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-600">
                    {formatPercent(totalRevenue > 0 ? c.revenueCents / totalRevenue : null)}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Where the overheads went">
          {categories.length === 0 ? (
            <p className="text-sm text-ink-600">
              No expenses recorded. Subscriptions and tools are the costs most often left out of a
              first set of books — they are what turn an apparently profitable month into a real
              one.
            </p>
          ) : (
            <Table head={['Category', 'Total']}>
              {categories.map(([category, cents]) => (
                <tr key={category}>
                  <td className="py-2.5 pr-4 text-ink-900">{category}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(cents)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Last 90 days, goods only">
        <p className="text-sm leading-relaxed text-ink-600">
          {formatMoney(last90.revenueCents)} revenue against {formatMoney(last90.cogsCents)} of
          goods — a gross margin of {formatPercent(last90.grossMargin)}. Ads and overheads are
          excluded here on purpose: this is the number that says whether the products themselves
          can support a business, before any question of how well you advertise them.
        </p>
      </Card>
    </div>
  )
}
