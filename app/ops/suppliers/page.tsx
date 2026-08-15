import { config, capabilities } from '@/lib/commerce/config'
import { formatMoney } from '@/lib/commerce/money'
import { listSupplierLinks, listSuppliers, listVariantsByIds } from '@/lib/commerce/db/repo'
import { ADAPTER_CATALOGUE, adapterFor } from '@/lib/commerce/suppliers/registry'
import { Badge, Card, Empty, Note, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsSuppliers() {
  const suppliers = await listSuppliers()
  const links = await listSupplierLinks()
  const variants = await listVariantsByIds(links.map((l) => l.variant_id))
  const supplierCaps = capabilities().filter((c) => c.key.startsWith('supplier'))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Suppliers</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-600">
          Suppliers are driven by adapters behind one interface. Swapping a supplier is a database
          change, not a code change.
        </p>
      </div>

      <Note tone="warning">
        Any supplier using the <strong>mock</strong> adapter simulates fulfilment. Orders are not
        sent anywhere and tracking numbers are fabricated. Move to a real adapter before taking real
        orders.
      </Note>

      {suppliers.length === 0 ? (
        <Empty title="No suppliers" body="Add a row to ds_suppliers to route orders somewhere." />
      ) : (
        <Card title="Configured suppliers">
          <Table head={['Supplier', 'Adapter', 'Ship window', 'Mapped variants', 'Notes']}>
            {suppliers.map((s) => {
              const adapter = adapterFor(s)
              const mapped = links.filter((l) => l.supplier_id === s.id)
              return (
                <tr key={s.id} className="align-top">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink-900">{s.name}</p>
                    <p className="text-xs text-ink-500">/{s.slug}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={adapter.status}>{adapter.status}</Badge>
                    <p className="mt-1 text-xs text-ink-600">{s.adapter}</p>
                  </td>
                  <td className="py-3 pr-4 text-ink-700">
                    {s.default_ship_days_min}–{s.default_ship_days_max} days
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-ink-900">{mapped.length}</td>
                  <td className="py-3 pr-4 max-w-sm text-xs leading-relaxed text-ink-600">
                    {adapter.note}
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>
      )}

      <Card title="Variant → supplier mapping">
        {links.length === 0 ? (
          <p className="text-sm text-ink-600">
            No variants are mapped to a supplier SKU. Orders for unmapped variants will be sent using
            our own SKU, which the supplier will reject — that failure is surfaced rather than
            hidden, but it is better to map them first.
          </p>
        ) : (
          <Table head={['Our SKU', 'Supplier SKU', 'Cost', 'Lead time', 'Last synced']}>
            {links.map((l) => {
              const variant = variants.find((v) => v.id === l.variant_id)
              return (
                <tr key={l.id}>
                  <td className="py-2.5 pr-4 text-ink-900">{variant?.sku ?? l.variant_id}</td>
                  <td className="py-2.5 pr-4 text-ink-700">{l.supplier_sku}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                    {formatMoney(l.supplier_cost_cents + l.supplier_ship_cents, config.currency)}
                  </td>
                  <td className="py-2.5 pr-4 text-ink-700">{l.lead_days}d</td>
                  <td className="py-2.5 pr-4 text-ink-600">
                    {l.last_synced_at ? l.last_synced_at.slice(0, 10) : 'never'}
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      <Card title="Available adapters">
        <div className="space-y-3">
          {ADAPTER_CATALOGUE.map((a) => (
            <div key={a.id} className="rounded-xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={a.status}>{a.status}</Badge>
                <p className="font-medium text-ink-900">{a.label}</p>
                <code className="text-xs text-ink-500">{a.id}</code>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{a.note}</p>
              {a.requires.length > 0 && (
                <p className="mt-1.5 text-xs text-ink-500">Requires: {a.requires.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Credentials">
        <div className="space-y-3">
          {supplierCaps.map((c) => (
            <div key={c.key} className="flex flex-wrap items-start gap-3">
              <Badge tone={c.configured ? 'REAL' : c.status}>{c.configured ? 'configured' : c.status}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{c.label}</p>
                <p className="text-xs leading-relaxed text-ink-600">{c.note}</p>
                {c.requires.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-500">Set: {c.requires.join(', ')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
