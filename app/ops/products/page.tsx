import Link from 'next/link'
import { config } from '@/lib/commerce/config'
import { formatMoney, formatPercent, grossMargin } from '@/lib/commerce/money'
import { allowedTransitions, isSellable } from '@/lib/commerce/research/scoring'
import { listProducts, listVariantsForProducts } from '@/lib/commerce/db/repo'
import { Badge, Card, Empty, StatusBadge, Table } from '@/components/ops/ui'
import { ProductAdmin } from '@/components/ops/ProductAdmin'

export const dynamic = 'force-dynamic'

export default async function OpsProducts() {
  const products = await listProducts({ sort: 'score' })
  const variants = await listVariantsForProducts(products.map((p) => p.id))

  const published = products.filter((p) => p.published).length
  const currency = config.currency

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="commerce-display text-2xl text-ink-900">Products</h1>
          <p className="mt-1 text-sm text-ink-600">
            {products.length} total · {published} published
          </p>
        </div>
        <Link
          href="/ops/research"
          className="min-h-10 rounded-full bg-ink-900 px-5 text-sm font-medium leading-10 text-sand-100"
        >
          Add a candidate
        </Link>
      </div>

      {products.length === 0 ? (
        <Empty
          title="No products yet"
          body="Score a candidate in the research console, then approve and publish it."
          href="/ops/research"
          cta="Open research"
        />
      ) : (
        <Card>
          <Table head={['Product', 'Score', 'Status', 'Price / margin', 'Performance', 'Actions']}>
            {products.map((p) => {
              const margin = grossMargin(p.price_cents, p.cost_cents, p.shipping_cost_cents)
              const productVariants = variants.filter((v) => v.product_id === p.id)
              const stock = productVariants.reduce(
                (sum, v) => (v.stock === null ? sum : sum + v.stock),
                0
              )
              const untracked = productVariants.some((v) => v.stock === null)

              return (
                <tr key={p.id} className="align-top">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-900">{p.name}</span>
                      {p.published && <Badge tone="positive">live</Badge>}
                      {p.featured && <Badge>featured</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      /{p.slug} · {p.category ?? 'uncategorised'} ·{' '}
                      {untracked ? 'stock untracked' : `${stock} in stock`}
                    </p>
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-ink-900">{p.product_score}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-3 pr-4">
                    <p className="tabular-nums text-ink-900">{formatMoney(p.price_cents, currency)}</p>
                    <p className="text-xs text-ink-500">
                      cost {formatMoney(p.cost_cents + p.shipping_cost_cents, currency)} · margin{' '}
                      {formatPercent(margin, 0)}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="tabular-nums text-ink-900">
                      {formatMoney(p.revenue_cents, currency)}
                    </p>
                    <p className="text-xs text-ink-500">
                      {p.orders_count} orders · ad spend {formatMoney(p.ad_spend_cents, currency)}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <ProductAdmin
                      productId={p.id}
                      name={p.name}
                      status={p.status}
                      published={p.published}
                      allowedStatuses={allowedTransitions(p.status)}
                      sellable={isSellable(p.status)}
                      ordersCount={p.orders_count}
                    />
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>
      )}

      <Card title="Rules enforced here">
        <ul className="space-y-1.5 text-sm text-ink-600">
          <li>Status changes follow the lifecycle machine — illegal jumps are rejected by the API, not just hidden in the UI.</li>
          <li>Only approved, testing, winner or scaling products can be published.</li>
          <li>A compare-at price below the selling price is rejected, so a fake discount cannot be created.</li>
          <li>Products with orders cannot be deleted — unpublish them instead, so order history stays intact.</li>
          <li>Generated copy is saved unapproved and passes a fabricated-claim scan before it is stored.</li>
        </ul>
      </Card>
    </div>
  )
}
