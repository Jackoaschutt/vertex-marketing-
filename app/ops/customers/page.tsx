import { config } from '@/lib/commerce/config'
import { formatMoney } from '@/lib/commerce/money'
import { listCustomers, listOrders } from '@/lib/commerce/db/repo'
import { Card, Empty, Stat, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsCustomers() {
  const [customers, orders] = await Promise.all([listCustomers(200), listOrders({ limit: 1000 })])
  const currency = config.currency

  const repeat = customers.filter((c) => c.orders_count > 1).length
  const totalSpend = customers.reduce((s, c) => s + c.spend_cents, 0)
  const optIn = customers.filter((c) => c.marketing_opt_in).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Customers</h1>
        <p className="mt-1 text-sm text-ink-600">{customers.length} recorded</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={String(customers.length)} />
        <Stat
          label="Repeat buyers"
          value={String(repeat)}
          sub={customers.length ? `${((repeat / customers.length) * 100).toFixed(0)}% of customers` : undefined}
        />
        <Stat label="Lifetime spend" value={formatMoney(totalSpend, currency)} />
        <Stat label="Marketing opt-in" value={String(optIn)} sub="explicit consent only" />
      </div>

      {customers.length === 0 ? (
        <Empty title="No customers yet" body="A customer record is created with the first order." />
      ) : (
        <Card title="Recent customers">
          <Table head={['Email', 'Orders', 'Spend', 'First order', 'Last order', 'Marketing']}>
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="py-2.5 pr-4 text-ink-900">{c.email}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{c.orders_count}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(c.spend_cents, currency)}</td>
                <td className="py-2.5 pr-4 text-ink-600">{c.first_order_at?.slice(0, 10) ?? '—'}</td>
                <td className="py-2.5 pr-4 text-ink-600">{c.last_order_at?.slice(0, 10) ?? '—'}</td>
                <td className="py-2.5 pr-4 text-ink-600">{c.marketing_opt_in ? 'opted in' : 'no'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card title="Data handling">
        <ul className="space-y-1.5 text-sm text-ink-600">
          <li>Card details never reach this system — Stripe holds them.</li>
          <li>Marketing email is sent only to customers who explicitly opted in. Transactional order email is separate and always sent.</li>
          <li>{orders.length} order records are retained for accounting. Set a retention period in the privacy policy before launch.</li>
        </ul>
      </Card>
    </div>
  )
}
