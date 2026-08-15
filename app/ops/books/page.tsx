import { formatMoney, formatPercent, formatRatio } from '@/lib/commerce/money'
import {
  computeProfit,
  daysAgoIso,
  todayIso,
  type ProfitSummary,
} from '@/lib/commerce/analytics/profit'
import { listAdMetrics, listExpenses, listProducts, listSales } from '@/lib/commerce/db/repo'
import { LedgerForm } from '@/components/ops/LedgerForm'
import { ExpenseForm } from '@/components/ops/ExpenseForm'
import { Card, Empty, Note, Stat, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

function monthStart(offset = 0): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - offset)
  return d.toISOString().slice(0, 10)
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-ink-700">{label}</td>
      <td
        className={`py-2 pr-4 text-right tabular-nums ${
          tone === 'good' ? 'text-moss-500' : tone === 'bad' ? 'text-clay-600' : 'text-ink-900'
        }`}
      >
        {value}
      </td>
    </tr>
  )
}

function PnlTable({ s }: { s: ProfitSummary }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-ink-100">
        <Row label="Revenue (after refunds)" value={formatMoney(s.revenueCents)} />
        <Row label="Cost of goods" value={`− ${formatMoney(s.cogsCents)}`} />
        <tr className="border-t border-ink-200">
          <td className="py-2 pr-4 font-medium text-ink-900">Gross profit</td>
          <td className="py-2 pr-4 text-right font-medium tabular-nums text-ink-900">
            {formatMoney(s.grossProfitCents)}
          </td>
        </tr>
        <Row label="Fees" value={`− ${formatMoney(s.feesCents)}`} />
        <Row label="Advertising" value={`− ${formatMoney(s.adSpendCents)}`} />
        <Row label="Other expenses" value={`− ${formatMoney(s.expensesCents)}`} />
        <tr className="border-t-2 border-ink-300">
          <td className="py-2.5 pr-4 font-medium text-ink-900">Net profit</td>
          <td
            className={`py-2.5 pr-4 text-right font-medium tabular-nums ${
              s.netProfitCents >= 0 ? 'text-moss-500' : 'text-clay-600'
            }`}
          >
            {formatMoney(s.netProfitCents)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export default async function OpsBooks() {
  const [products, sales, adMetrics, expenses] = await Promise.all([
    listProducts({ sort: 'name' }),
    listSales(),
    listAdMetrics(),
    listExpenses(),
  ])

  const thisMonth = monthStart()
  const lastMonth = monthStart(1)

  const inWindow = (from: string, to?: string) => ({
    sales: sales.filter((s) => s.day >= from && (!to || s.day < to)),
    adMetrics: adMetrics.filter((m) => m.day >= from && (!to || m.day < to)),
    expenses: expenses.filter((e) => e.day >= from && (!to || e.day < to)),
  })

  const current = computeProfit(inWindow(thisMonth))
  const previous = computeProfit(inWindow(lastMonth, thisMonth))
  const allTime = computeProfit({ sales, adMetrics, expenses })

  const productName = (id: string | null) =>
    id ? (products.find((p) => p.id === id)?.name ?? 'Unknown product') : '—'

  const recent = sales.slice(0, 25)
  const lastChannel = sales[0]?.channel
  const daysEntered = new Set(sales.map((s) => s.day)).size

  // A day with ad spend but no sales row is the failure mode of a hand-kept
  // ledger, so it is surfaced here rather than only in the nightly job.
  const salesDays = new Set(sales.map((s) => s.day))
  const gaps: string[] = []
  for (let i = 1; i <= 13; i += 1) {
    const day = daysAgoIso(i)
    if (adMetrics.some((m) => m.day === day) && !salesDays.has(day)) gaps.push(day)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Books</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
          Every figure in this tool is computed from what you enter here and nothing else. Nothing
          is estimated, and no total is cached anywhere — which is why correcting a day corrects
          the whole history immediately.
        </p>
      </div>

      {gaps.length > 0 && (
        <Note tone="warning">
          <strong>
            {gaps.length} day{gaps.length === 1 ? '' : 's'} with ad spend but no sales entry.
          </strong>{' '}
          Those days count advertising against zero revenue, so your profit and ROAS are currently
          understated. Missing: {gaps.slice(0, 6).join(', ')}
          {gaps.length > 6 ? '…' : ''}. If a day genuinely had no sales, enter it as zero — that is
          a fact, and it stops this warning coming back.
        </Note>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="This month net"
          value={formatMoney(current.netProfitCents)}
          tone={current.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`${formatMoney(current.revenueCents)} revenue`}
        />
        <Stat
          label="Last month net"
          value={formatMoney(previous.netProfitCents)}
          tone={previous.netProfitCents >= 0 ? 'positive' : 'negative'}
          sub={`${formatMoney(previous.revenueCents)} revenue`}
        />
        <Stat
          label="This month ROAS"
          value={formatRatio(current.roas)}
          sub={
            current.adSpendCents === 0
              ? 'No ad spend recorded'
              : `${formatMoney(current.adSpendCents)} spent`
          }
        />
        <Stat
          label="Days entered"
          value={String(daysEntered)}
          sub={daysEntered === 0 ? 'Nothing entered yet' : 'Across all time'}
        />
      </div>

      <Card title="Record a day">
        <LedgerForm
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          lastChannel={lastChannel}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`This month — from ${thisMonth}`}>
          <PnlTable s={current} />
          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            Gross margin {formatPercent(current.grossMargin)}, net margin{' '}
            {formatPercent(current.netMargin)}. A dash means there is no denominator yet — not
            zero.
          </p>
        </Card>
        <Card title="All time">
          <PnlTable s={allTime} />
          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            {allTime.units} unit(s) sold, {allTime.refundUnits} refunded (
            {formatPercent(allTime.refundRate)}).
          </p>
        </Card>
      </div>

      <Card title="Other expenses">
        <p className="mb-4 text-sm leading-relaxed text-ink-600">
          Subscriptions, tools, samples, courses, contractors — anything that is neither the goods
          nor the advertising. These are what separate a month that looked profitable from one that
          was.
        </p>
        <ExpenseForm />
        {expenses.length > 0 && (
          <div className="mt-6">
            <Table head={['Day', 'Label', 'Category', 'Amount']}>
              {expenses.slice(0, 10).map((e) => (
                <tr key={e.id}>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-700">{e.day}</td>
                  <td className="py-2.5 pr-4 text-ink-900">{e.label}</td>
                  <td className="py-2.5 pr-4 text-ink-600">{e.category}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                    {formatMoney(e.amount_cents)}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>

      <Card title="Recent entries">
        {recent.length === 0 ? (
          <Empty
            title="The ledger is empty"
            body="Enter a day above. Until then every profit figure in this tool is zero because nothing has been recorded — not because nothing sold."
          />
        ) : (
          <Table head={['Day', 'Product', 'Channel', 'Units', 'Revenue', 'COGS', 'Fees', 'Refunds']}>
            {recent.map((s) => (
              <tr key={s.id}>
                <td className="py-2.5 pr-4 tabular-nums text-ink-700">{s.day}</td>
                <td className="py-2.5 pr-4 text-ink-900">{productName(s.product_id)}</td>
                <td className="py-2.5 pr-4 text-ink-600">{s.channel}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{s.units}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                  {formatMoney(s.revenue_cents)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-600">
                  {formatMoney(s.cogs_cents + s.shipping_cost_cents)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-600">
                  {formatMoney(s.fees_cents)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-600">
                  {s.refunds_cents > 0 ? formatMoney(s.refunds_cents) : '—'}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
