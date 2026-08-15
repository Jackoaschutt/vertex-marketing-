import { config } from '@/lib/commerce/config'
import { formatMoney, formatRatio, safeDivide } from '@/lib/commerce/money'
import { isSellable } from '@/lib/commerce/research/scoring'
import { computeProductPnl, daysAgoIso } from '@/lib/commerce/analytics/profit'
import { listAdMetrics, listProducts, listSales } from '@/lib/commerce/db/repo'
import { isMetaConfigured } from '@/lib/commerce/marketing/adapter-meta'
import { Badge, Card, Empty, Note, Stat, Table } from '@/components/ops/ui'
import { SpendForm } from '@/components/ops/SpendForm'
import { MetaPanel } from '@/components/ops/MetaPanel'

export const dynamic = 'force-dynamic'

export default async function OpsMarketing() {
  const since = daysAgoIso(29)
  const [products, metrics, sales] = await Promise.all([
    listProducts({ sort: 'name' }),
    listAdMetrics(since),
    listSales(since),
  ])

  const spend = metrics.reduce((sum, m) => sum + m.spend_cents, 0)
  const clicks = metrics.reduce((sum, m) => sum + m.clicks, 0)
  const impressions = metrics.reduce((sum, m) => sum + m.impressions, 0)
  const revenue = sales.reduce((sum, s) => sum + s.revenue_cents - s.refunds_cents, 0)

  const pnl = computeProductPnl(products, sales, metrics).filter(
    (p) => p.summary.adSpendCents > 0
  )
  const unattributed = metrics.filter((m) => !m.product_id)
  const unattributedSpend = unattributed.reduce((sum, m) => sum + m.spend_cents, 0)

  const byChannel = new Map<string, number>()
  for (const m of metrics) byChannel.set(m.channel, (byChannel.get(m.channel) ?? 0) + m.spend_cents)

  const productName = (id: string | null) =>
    id ? (products.find((p) => p.id === id)?.name ?? 'Unknown') : 'Unattributed'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Marketing</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
          What you spent to get the revenue in your books. Meta can import itself; everything else
          is entered by hand, and those figures are just as real.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="30-day ad spend" value={formatMoney(spend)} sub={`${metrics.length} row(s)`} />
        <Stat
          label="Blended ROAS"
          value={formatRatio(safeDivide(revenue, spend))}
          sub="Revenue ÷ all ad spend"
        />
        <Stat
          label="Clicks"
          value={clicks.toLocaleString()}
          sub={
            impressions > 0
              ? `${((clicks / impressions) * 100).toFixed(2)}% of ${impressions.toLocaleString()} impressions`
              : 'No impressions recorded'
          }
        />
        <Stat
          label="Unattributed"
          value={formatMoney(unattributedSpend)}
          tone={unattributedSpend > 0 ? 'negative' : 'neutral'}
          sub={`${unattributed.length} row(s) with no product`}
        />
      </div>

      {unattributedSpend > 0 && (
        <Note tone="warning">
          <strong>{formatMoney(unattributedSpend)} of spend is not attached to a product.</strong>{' '}
          It counts toward your total ad cost and whole-business profit, but not toward any
          product&apos;s ROAS — so per-product figures look better than reality. Add a{' '}
          <code>[vsp:&lt;product-slug&gt;]</code> marker to the campaign name, or map the campaign
          below.
        </Note>
      )}

      <Card title="Meta Ads">
        {isMetaConfigured() ? (
          <MetaPanel
            products={products.map((p) => ({ id: p.id, name: p.name }))}
            sellableProducts={products
              .filter((p) => isSellable(p.status))
              .map((p) => ({ id: p.id, name: p.name, slug: p.slug }))}
            currency={config.currency}
          />
        ) : (
          <Note>
            Meta is not connected. Set <code>META_ACCESS_TOKEN</code> and{' '}
            <code>META_AD_ACCOUNT_ID</code> to import spend automatically. Until then, enter it
            below — the resulting ROAS and CPA are identical, they just are not automatic.
          </Note>
        )}
      </Card>

      <Card title="Record spend by hand">
        <SpendForm products={products.map((p) => ({ id: p.id, name: p.name }))} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Spend by channel">
          {byChannel.size === 0 ? (
            <p className="text-sm text-ink-600">Nothing recorded in the last 30 days.</p>
          ) : (
            <Table head={['Channel', '30-day spend']}>
              {[...byChannel.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([channel, cents]) => (
                  <tr key={channel}>
                    <td className="py-2.5 pr-4 text-ink-900">{channel}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-ink-900">{formatMoney(cents)}</td>
                  </tr>
                ))}
            </Table>
          )}
        </Card>

        <Card title="Return per product">
          {pnl.length === 0 ? (
            <Empty
              title="No product has spend against it"
              body="Attribute spend to a product to see which one is actually paying for itself."
            />
          ) : (
            <Table head={['Product', 'Spend', 'Net', 'ROAS']}>
              {pnl.map(({ product, summary }) => (
                <tr key={product.id}>
                  <td className="py-2.5 pr-4 text-ink-900">{product.name}</td>
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
          )}
        </Card>
      </div>

      <Card title="Recent spend rows">
        {metrics.length === 0 ? (
          <Empty title="Nothing recorded" body="Enter a day of spend above, or connect Meta." />
        ) : (
          <Table head={['Day', 'Product', 'Channel', 'Campaign', 'Spend', 'Source']}>
            {metrics.slice(0, 20).map((m) => (
              <tr key={m.id}>
                <td className="py-2.5 pr-4 tabular-nums text-ink-700">{m.day}</td>
                <td className="py-2.5 pr-4 text-ink-900">{productName(m.product_id)}</td>
                <td className="py-2.5 pr-4 text-ink-600">{m.channel}</td>
                <td className="py-2.5 pr-4 text-xs text-ink-500">{m.campaign_ref ?? '—'}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                  {formatMoney(m.spend_cents)}
                </td>
                <td className="py-2.5 pr-4">
                  <Badge tone={m.source === 'manual' ? 'info' : 'positive'}>{m.source}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
