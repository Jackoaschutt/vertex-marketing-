import Link from 'next/link'
import { formatMoney, formatPercent, formatRatio, grossMargin } from '@/lib/commerce/money'
import { computeProductPnl } from '@/lib/commerce/analytics/profit'
import { listAdMetrics, listAllChecklistProgress, listProducts, listSales } from '@/lib/commerce/db/repo'
import { CHECKLISTS, stageForStatus } from '@/lib/commerce/research/checklist'
import { Badge, Card, Empty, StatusBadge, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsProducts() {
  const [products, sales, adMetrics, progress] = await Promise.all([
    listProducts({ sort: 'score' }),
    listSales(),
    listAdMetrics(),
    listAllChecklistProgress(),
  ])

  const pnl = computeProductPnl(products, sales, adMetrics)
  const byId = new Map(pnl.map((p) => [p.product.id, p.summary]))

  const stageProgress = (productId: string, status: (typeof products)[number]['status']) => {
    const stage = stageForStatus(status)
    if (!stage) return null
    const items = CHECKLISTS[stage]
    const done = progress.filter(
      (p) => p.product_id === productId && p.stage === stage && p.done
    ).length
    return { stage, done, total: items.length }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Products</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
          Every candidate you have looked at, with its rubric score, how far through its stage it
          is, and what it has actually earned. Score and earnings are deliberately shown side by
          side — the gap between them is the most useful thing on this page.
        </p>
      </div>

      {products.length === 0 ? (
        <Empty
          title="No candidates yet"
          body="Score your first product idea in Research. It stays here through validation, testing and whatever it ends up being."
          href="/ops/research"
          cta="Go to Research"
        />
      ) : (
        <Card title={`Pipeline (${products.length})`}>
          <Table
            head={['Product', 'Status', 'Stage', 'Score', 'Margin', 'Net', 'ROAS']}
          >
            {products.map((p) => {
              const s = byId.get(p.id)
              const prog = stageProgress(p.id, p.status)
              const margin = grossMargin(p.price_cents, p.cost_cents, p.shipping_cost_cents)
              return (
                <tr key={p.id} className="align-top">
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/ops/products/${p.id}`}
                      className="text-ink-900 underline decoration-ink-300 underline-offset-2"
                    >
                      {p.name}
                    </Link>
                    <span className="block text-xs text-ink-500">
                      {p.category ?? 'uncategorised'}
                      {p.sell_channel ? ` · ${p.sell_channel}` : ''}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-2.5 pr-4 text-sm text-ink-600">
                    {prog ? (
                      <span className={prog.done === prog.total ? 'text-moss-500' : undefined}>
                        {prog.done}/{prog.total} {prog.stage}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-900">{p.product_score}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-700">
                    {formatPercent(margin)}
                  </td>
                  <td
                    className={`py-2.5 pr-4 tabular-nums ${
                      !s || s.netProfitCents === 0
                        ? 'text-ink-500'
                        : s.netProfitCents > 0
                          ? 'text-moss-500'
                          : 'text-clay-600'
                    }`}
                  >
                    {s ? formatMoney(s.netProfitCents) : '—'}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-700">
                    {s ? formatRatio(s.roas) : '—'}
                  </td>
                </tr>
              )
            })}
          </Table>
          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            Margin is modelled from the price and cost you entered. Net and ROAS come from the
            ledger, so a product with no entries shows a dash rather than zero.
          </p>
        </Card>
      )}

      <Card title="How to read this">
        <ul className="space-y-2 text-sm leading-relaxed text-ink-600">
          <li>
            <Badge tone="info">Score high, earnings low</Badge> — the rubric liked it and the
            market did not. Worth a post-mortem: usually the angle or the creative, not the
            product.
          </li>
          <li>
            <Badge tone="info">Score low, earnings high</Badge> — your rubric inputs were wrong.
            Go back and check which component you under-rated; that is a lesson about your
            judgement, which is worth more than the product.
          </li>
          <li>
            <Badge tone="info">Stage incomplete for weeks</Badge> — the weekly job will flag it.
            Finish it or reject it; a parked candidate costs attention and produces no answer.
          </li>
        </ul>
      </Card>
    </div>
  )
}
