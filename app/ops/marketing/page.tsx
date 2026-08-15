import { config } from '@/lib/commerce/config'
import { formatMoney, formatRatio, safeDivide } from '@/lib/commerce/money'
import { daysAgoIso } from '@/lib/commerce/analytics/profit'
import { listAbandonedCarts, listAdMetrics, listEmailLog, listProducts } from '@/lib/commerce/db/repo'
import { CHANNELS } from '@/lib/commerce/marketing/channels'
import { Badge, Card, Empty, Note, Table } from '@/components/ops/ui'
import { SpendForm } from '@/components/ops/SpendForm'

export const dynamic = 'force-dynamic'

export default async function OpsMarketing() {
  const since = daysAgoIso(30).slice(0, 10)
  const [products, metrics, carts, emails] = await Promise.all([
    listProducts({}),
    listAdMetrics(since),
    listAbandonedCarts(50),
    listEmailLog(30),
  ])
  const currency = config.currency

  const byChannel = new Map<string, { spend: number; revenue: number; purchases: number; clicks: number; impressions: number }>()
  for (const m of metrics) {
    const e = byChannel.get(m.channel) ?? { spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0 }
    e.spend += m.spend_cents
    e.revenue += m.revenue_cents
    e.purchases += m.purchases
    e.clicks += m.clicks
    e.impressions += m.impressions
    byChannel.set(m.channel, e)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Marketing</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-600">
          Ad spend entered here is real data — it feeds ROAS, CPA and net profit exactly as an API
          import would.
        </p>
      </div>

      <Card title="Record ad spend">
        <SpendForm products={products.map((p) => ({ id: p.id, name: p.name }))} />
      </Card>

      <Card title="Last 30 days by channel">
        {byChannel.size === 0 ? (
          <Empty
            title="No ad spend recorded"
            body="Until spend is recorded, ROAS and CPA cannot be computed and will show a dash rather than zero."
          />
        ) : (
          <Table head={['Channel', 'Spend', 'Attributed revenue', 'ROAS', 'Purchases', 'CPA', 'CTR']}>
            {[...byChannel.entries()].map(([channel, v]) => (
              <tr key={channel}>
                <td className="py-2.5 pr-4 text-ink-900">{channel}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(v.spend, currency)}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(v.revenue, currency)}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                  {formatRatio(safeDivide(v.revenue, v.spend))}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{v.purchases}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                  {v.purchases > 0 ? formatMoney(Math.round(v.spend / v.purchases), currency) : '—'}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                  {v.impressions > 0 ? `${((v.clicks / v.impressions) * 100).toFixed(2)}%` : '—'}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Channel integrations">
        <div className="space-y-3">
          {CHANNELS.map((c) => (
            <div key={c.id} className="rounded-xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={c.status}>{c.status}</Badge>
                <p className="font-medium text-ink-900">{c.label}</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{c.note}</p>
              {c.requires.length > 0 && (
                <p className="mt-1 text-xs text-ink-500">Requires: {c.requires.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Abandoned carts">
        {carts.length === 0 ? (
          <p className="text-sm text-ink-600">No unrecovered carts.</p>
        ) : (
          <Table head={['Email', 'Value', 'Items', 'Created', 'Reminder']}>
            {carts.map((c) => (
              <tr key={c.id}>
                <td className="py-2.5 pr-4 text-ink-900">{c.email ?? '(not captured)'}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(c.value_cents, currency)}</td>
                <td className="py-2.5 pr-4 text-ink-700">{c.items.length}</td>
                <td className="py-2.5 pr-4 text-ink-600">{c.created_at.slice(0, 16).replace('T', ' ')}</td>
                <td className="py-2.5 pr-4 text-ink-600">
                  {c.reminded_at ? c.reminded_at.slice(0, 10) : 'not sent'}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-4">
          <Note>
            A recovery email is sent once, at least an hour after abandonment, only where an email
            address was captured. It contains no discount code and no countdown.
          </Note>
        </div>
      </Card>

      <Card
        title="Recent email"
        action={<Badge tone={config.emailConfigured ? 'REAL' : 'MOCK'}>{config.emailConfigured ? 'resend' : 'console'}</Badge>}
      >
        {emails.length === 0 ? (
          <p className="text-sm text-ink-600">Nothing sent yet.</p>
        ) : (
          <Table head={['Template', 'To', 'Subject', 'Transport', 'Status', 'When']}>
            {emails.map((e) => (
              <tr key={e.id}>
                <td className="py-2.5 pr-4 text-ink-900">{e.template}</td>
                <td className="py-2.5 pr-4 text-ink-700">{e.to_email}</td>
                <td className="py-2.5 pr-4 text-ink-700">{e.subject}</td>
                <td className="py-2.5 pr-4 text-ink-600">{e.transport}</td>
                <td className="py-2.5 pr-4 text-ink-600">{e.status}</td>
                <td className="py-2.5 pr-4 text-ink-600">{e.created_at.slice(0, 16).replace('T', ' ')}</td>
              </tr>
            ))}
          </Table>
        )}
        {!config.emailConfigured && (
          <div className="mt-4">
            <Note tone="warning">
              The console transport is active: emails are rendered and logged but never delivered.
              Set <code>RESEND_API_KEY</code> and <code>COMMERCE_FROM_EMAIL</code> before launch, or
              customers will never receive order confirmations.
            </Note>
          </div>
        )}
      </Card>
    </div>
  )
}
