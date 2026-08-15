import { capabilities } from '@/lib/commerce/config'
import { formatMoney, formatPercent, grossMargin } from '@/lib/commerce/money'
import { listProducts, listSuppliers } from '@/lib/commerce/db/repo'
import { ADAPTER_CATALOGUE } from '@/lib/commerce/suppliers/registry'
import { Badge, Card, Empty, Note, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsSuppliers() {
  const [suppliers, products] = await Promise.all([listSuppliers(), listProducts({ sort: 'name' })])
  const supplierCaps = capabilities().filter((c) => c.key.startsWith('supplier'))

  const countFor = (id: string) => products.filter((p) => p.supplier_id === id).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Sourcing</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
          Where each candidate would come from and what it costs to land. This is research
          reference, not fulfilment — you place orders wherever you actually sell.
        </p>
      </div>

      <Card title="Suppliers">
        {suppliers.length === 0 ? (
          <Empty
            title="No suppliers recorded"
            body="Add the supplier you sourced a product from so its cost and lead time sit next to the research."
          />
        ) : (
          <Table head={['Supplier', 'Adapter', 'Lead time', 'Products', 'Notes']}>
            {suppliers.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="py-2.5 pr-4">
                  <span className="text-ink-900">{s.name}</span>
                  {s.website && (
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block text-xs text-ink-500 underline"
                    >
                      {s.website}
                    </a>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <Badge tone={s.adapter === 'mock' ? 'MOCK' : 'info'}>{s.adapter}</Badge>
                </td>
                <td className="py-2.5 pr-4 text-ink-700">
                  {s.default_ship_days_min}–{s.default_ship_days_max} days
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-700">{countFor(s.id)}</td>
                <td className="py-2.5 pr-4 text-sm text-ink-600">{s.notes ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Landed cost and modelled margin">
        {products.length === 0 ? (
          <Empty title="No products yet" body="Score a candidate in Research first." />
        ) : (
          <>
            <Table head={['Product', 'Supplier', 'Unit cost', 'Shipping', 'Price', 'Margin']}>
              {products.map((p) => {
                const supplier = suppliers.find((s) => s.id === p.supplier_id)
                const margin = grossMargin(p.price_cents, p.cost_cents, p.shipping_cost_cents)
                return (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-4 text-ink-900">{p.name}</td>
                    <td className="py-2.5 pr-4 text-ink-600">{supplier?.name ?? '—'}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-ink-700">
                      {formatMoney(p.cost_cents)}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-ink-700">
                      {formatMoney(p.shipping_cost_cents)}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                      {formatMoney(p.price_cents)}
                    </td>
                    <td
                      className={`py-2.5 pr-4 tabular-nums ${
                        margin !== null && margin < 0.2 ? 'text-clay-600' : 'text-ink-900'
                      }`}
                    >
                      {formatPercent(margin)}
                    </td>
                  </tr>
                )
              })}
            </Table>
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              Margin here is modelled from the numbers you entered, before advertising. Anything
              under about 20% leaves nothing to pay for traffic, and no amount of scale fixes that.
            </p>
          </>
        )}
      </Card>

      <Card title="Cost lookup adapters">
        <p className="mb-4 text-sm leading-relaxed text-ink-600">
          These fetch catalogue and price data from a supplier so the cost in your research is a
          real number rather than a guess. Order placement was removed with the storefront — this
          tool does not fulfil anything.
        </p>
        <div className="space-y-3">
          {ADAPTER_CATALOGUE.map((a) => (
            <div key={a.id} className="rounded-xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={a.status}>{a.status}</Badge>
                <p className="font-medium text-ink-900">{a.label}</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{a.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {supplierCaps.map((c) => (
            <Note key={c.key} tone={c.configured ? 'info' : 'warning'}>
              <strong>{c.label}:</strong> {c.note}
              {c.requires.length > 0 && (
                <>
                  {' '}
                  Needs{' '}
                  {c.requires.map((r) => (
                    <code key={r} className="mx-0.5">
                      {r}
                    </code>
                  ))}
                  .
                </>
              )}
            </Note>
          ))}
        </div>
      </Card>
    </div>
  )
}
