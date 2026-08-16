'use client'

import { useMemo, useState } from 'react'
import { useStore, type Supplier } from '@/lib/store'
import { formatMoney, formatPercent, toCents } from '@/lib/money'
import { compare, metricsFor, priceForMargin, VETTING } from '@/lib/sourcing'
import { supplierSearches } from '@/lib/research'
import { Button, Card, Empty, Note, Skeleton } from '@/components/ui'

export default function SuppliersPage() {
  const { data, ready, addSupplier, updateSupplier, removeSupplier } = useStore()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    product: '',
    source: 'AliExpress',
    unitCost: '',
    shipping: '',
    leadMin: '7',
    leadMax: '14',
    moq: '1',
    url: '',
  })

  const links = useMemo(() => supplierSearches(search), [search])
  const rows = useMemo(() => compare(data.suppliers), [data.suppliers])

  if (!ready) return <Skeleton />

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    addSupplier({
      name: form.name.trim(),
      product: form.product.trim() || form.name.trim(),
      source: form.source,
      unitCostCents: toCents(form.unitCost),
      shippingCostCents: toCents(form.shipping),
      leadDaysMin: Number(form.leadMin) || 0,
      leadDaysMax: Number(form.leadMax) || 0,
      moq: Number(form.moq) || 1,
      url: form.url.trim() || undefined,
      checks: {},
    })
    setForm({ ...form, name: '', product: '', unitCost: '', shipping: '', url: '' })
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          Compare on what they actually cost you — unit plus the shipping you pay — not on the
          sticker price.
        </p>
      </div>

      <Card title="Find one">
        <p className="text-sm leading-relaxed text-ink-600">
          Type a product and these open the right searches. Each one says what you are looking for
          when you get there.
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="weighted sleep mask"
          className="mt-3 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
        />
        {links.length > 0 && (
          <div className="mt-3 space-y-2">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="block rounded-xl border border-ink-200 p-3 transition hover:border-ink-900"
              >
                <p className="text-sm font-medium text-ink-900">{l.label} ↗</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">{l.looking}</p>
              </a>
            ))}
          </div>
        )}
      </Card>

      {open ? (
        <Card title="Add a supplier">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-ink-700">Supplier</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={60}
                  className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-700">Where from</span>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
                >
                  {['AliExpress', 'Alibaba', 'CJdropshipping', 'Local', 'Other'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-ink-700">Product</span>
              <input
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
                maxLength={80}
                className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-ink-700">Unit cost</span>
                <input
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-700">Shipping you pay</span>
                <input
                  value={form.shipping}
                  onChange={(e) => setForm({ ...form, shipping: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ['leadMin', 'Days min'],
                  ['leadMax', 'Days max'],
                  ['moq', 'Min order'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-xs font-medium text-ink-700">{label}</span>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    inputMode="numeric"
                    className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="text-xs font-medium text-ink-700">Link (optional)</span>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://"
                className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button onClick={() => setOpen(true)}>Add a supplier</Button>
      )}

      {data.suppliers.length === 0 ? (
        <Empty
          title="No suppliers saved"
          body="Add two or three for the same product and this will compare them on landed cost, speed and how well you have checked them out."
        />
      ) : (
        <>
          {rows.length > 1 && (
            <Note>
              Cheapest is not automatically best. A supplier {formatMoney(rows[rows.length - 1].landedCents - rows[0].landedCents)} more
              expensive but two weeks faster will usually cost you less overall once refunds are
              counted.
            </Note>
          )}
          {rows.map((row) => (
            <SupplierCard
              key={row.supplier.id}
              supplier={row.supplier}
              cheapest={row.cheapest}
              fastest={row.fastest}
              onUpdate={updateSupplier}
              onRemove={removeSupplier}
            />
          ))}
        </>
      )}
    </div>
  )
}

function SupplierCard({
  supplier,
  cheapest,
  fastest,
  onUpdate,
  onRemove,
}: {
  supplier: Supplier
  cheapest: boolean
  fastest: boolean
  onUpdate: (id: string, patch: Partial<Supplier>) => void
  onRemove: (id: string) => void
}) {
  const m = metricsFor(supplier)
  const [sell, setSell] = useState('')
  const sellCents = toCents(sell)

  function toggle(key: string) {
    onUpdate(supplier.id, { checks: { ...supplier.checks, [key]: !supplier.checks[key] } })
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{supplier.name}</p>
          <p className="text-xs text-ink-500">
            {supplier.product} · {supplier.source}
            {supplier.moq > 1 ? ` · min ${supplier.moq}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {cheapest && (
            <span className="rounded-full bg-moss-500 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-white">
              Cheapest
            </span>
          )}
          {fastest && (
            <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-sand-50">
              Fastest
            </span>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-500">Landed cost</dt>
          <dd className="tabular-nums text-ink-900">{formatMoney(m.landedCents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Delivery</dt>
          <dd className="tabular-nums text-ink-900">
            {supplier.leadDaysMin}–{supplier.leadDaysMax} days
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Checked</dt>
          <dd className="tabular-nums text-ink-900">
            {m.vetted}/{VETTING.length}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl bg-sand-100 p-3">
        <label className="block">
          <span className="text-xs font-medium text-ink-700">If you sold it for…</span>
          <input
            value={sell}
            onChange={(e) => setSell(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 h-11 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
          />
        </label>
        {sellCents > 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            You keep <strong>{formatMoney(m.marginCents(sellCents))}</strong> per sale, a margin of{' '}
            <strong>{formatPercent(m.marginPercent(sellCents))}</strong>. That is your entire budget
            for getting a customer — if ads cost more than that, you lose money on every order.
          </p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            For a 60% margin you would need to charge{' '}
            {formatMoney(priceForMargin(m.landedCents, 0.6))}, and for 70%,{' '}
            {formatMoney(priceForMargin(m.landedCents, 0.7))}.
          </p>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-500">
          Before you commit
        </p>
        <ul className="space-y-1">
          {VETTING.map((v) => (
            <li key={v.key} className="rounded-xl border border-ink-100 p-2.5">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={Boolean(supplier.checks[v.key])}
                  onChange={() => toggle(v.key)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded accent-moss-600"
                />
                <span>
                  <span
                    className={`block text-sm leading-snug ${
                      supplier.checks[v.key] ? 'text-ink-400 line-through' : 'text-ink-900'
                    }`}
                  >
                    {v.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{v.why}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-200 pt-4">
        {supplier.url && (
          <a
            href={supplier.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-ink-700 underline underline-offset-2"
          >
            Open listing ↗
          </a>
        )}
        <button
          onClick={() => onRemove(supplier.id)}
          className="ml-auto min-h-11 px-2 text-sm text-ink-500 hover:text-clay-600"
        >
          Delete
        </button>
      </div>
    </Card>
  )
}
