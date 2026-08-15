import { formatMoney } from '@/lib/commerce/money'
import { listPostmortems, listProducts } from '@/lib/commerce/db/repo'
import { FACTORS, factorLabel } from '@/lib/commerce/research/factors'
import { PostmortemEditor } from '@/components/ops/PostmortemEditor'
import { Badge, Card, Empty, Note, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsPostmortems() {
  const [postmortems, products] = await Promise.all([listPostmortems(), listProducts({})])

  const finished = products.filter((p) => p.status === 'winner' || p.status === 'loser')
  const written = new Set(postmortems.map((p) => p.product_id))
  const missing = finished.filter((p) => !written.has(p.id))
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? 'Unknown product'

  // The point of a fixed vocabulary: causes can be counted.
  const counts = new Map<string, { winners: number; losers: number }>()
  for (const pm of postmortems) {
    for (const f of pm.factors) {
      const c = counts.get(f) ?? { winners: 0, losers: 0 }
      if (pm.outcome === 'winner') c.winners += 1
      if (pm.outcome === 'loser') c.losers += 1
      counts.set(f, c)
    }
  }
  const patterns = [...counts.entries()]
    .map(([key, c]) => ({ key, ...c, total: c.winners + c.losers }))
    .filter((p) => p.total > 1)
    .sort((a, b) => b.total - a.total)

  const money = (v: unknown) => (typeof v === 'number' ? formatMoney(v) : '—')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Post-mortems</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
          Why each finished product won or died. The figures are snapshotted when you write, so the
          story can never drift from what actually happened, and the causes come from a fixed list
          so they can be counted across products rather than re-read one at a time.
        </p>
      </div>

      {missing.length > 0 && (
        <Note tone="warning">
          <strong>
            {missing.length} finished product{missing.length === 1 ? '' : 's'} with no post-mortem:
          </strong>{' '}
          {missing.map((p) => p.name).join(', ')}. Five minutes each is worth more than the next
          product test — the pattern analysis below is only as good as what is written here.
        </Note>
      )}

      {patterns.length > 0 && (
        <Card title="What your outcomes have in common">
          <Table head={['Cause', 'In winners', 'In losers', 'Total']}>
            {patterns.map((p) => (
              <tr key={p.key}>
                <td className="py-2.5 pr-4 text-ink-900">{factorLabel(p.key)}</td>
                <td className="py-2.5 pr-4 tabular-nums text-moss-500">{p.winners || '—'}</td>
                <td className="py-2.5 pr-4 tabular-nums text-clay-600">{p.losers || '—'}</td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-700">{p.total}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            Only causes appearing more than once are shown, and only because you tagged them. This
            counts your own attributions — it is not an analysis of what actually caused anything.
          </p>
        </Card>
      )}

      <Card title="Write a post-mortem">
        {finished.length === 0 ? (
          <p className="text-sm text-ink-600">
            Nothing has finished yet. A product becomes eligible once you mark it a winner or a
            loser in Products.
          </p>
        ) : (
          <PostmortemEditor
            products={finished.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
            factors={FACTORS.map((f) => ({ key: f.key, label: f.label, polarity: f.polarity }))}
          />
        )}
      </Card>

      {postmortems.length === 0 ? (
        <Empty
          title="No post-mortems yet"
          body="The first one is the hardest and the most valuable. Write it while you still remember what you were thinking when you started."
        />
      ) : (
        <Card title={`Written (${postmortems.length})`}>
          <div className="space-y-5">
            {postmortems.map((pm) => (
              <article key={pm.id} className="rounded-xl border border-ink-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={pm.outcome === 'winner' ? 'positive' : pm.outcome === 'loser' ? 'critical' : 'info'}>
                    {pm.outcome}
                  </Badge>
                  <h3 className="font-medium text-ink-900">{productName(pm.product_id)}</h3>
                  <span className="ml-auto text-xs tabular-nums text-ink-500">
                    {money(pm.snapshot.revenueCents)} revenue · {money(pm.snapshot.adSpendCents)}{' '}
                    ads · {money(pm.snapshot.netProfitCents)} net
                  </span>
                </div>

                <dl className="mt-3 space-y-2 text-sm leading-relaxed">
                  {pm.what_happened && (
                    <div>
                      <dt className="text-xs font-medium text-ink-500">What happened</dt>
                      <dd className="whitespace-pre-wrap text-ink-700">{pm.what_happened}</dd>
                    </div>
                  )}
                  {pm.what_worked && (
                    <div>
                      <dt className="text-xs font-medium text-ink-500">What worked</dt>
                      <dd className="whitespace-pre-wrap text-ink-700">{pm.what_worked}</dd>
                    </div>
                  )}
                  {pm.what_failed && (
                    <div>
                      <dt className="text-xs font-medium text-ink-500">What failed</dt>
                      <dd className="whitespace-pre-wrap text-ink-700">{pm.what_failed}</dd>
                    </div>
                  )}
                  {pm.next_time && (
                    <div>
                      <dt className="text-xs font-medium text-ink-500">Next time</dt>
                      <dd className="whitespace-pre-wrap text-ink-700">{pm.next_time}</dd>
                    </div>
                  )}
                </dl>

                {pm.factors.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {pm.factors.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.7rem] text-ink-600"
                      >
                        {factorLabel(f)}
                      </span>
                    ))}
                  </p>
                )}
              </article>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
