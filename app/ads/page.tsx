'use client'

import { useMemo, useState } from 'react'
import { useStore, today, type Campaign, type CampaignStatus } from '@/lib/store'
import { formatMoney, formatPercent, toCents } from '@/lib/money'
import { assess, metricsFor, totalsAcross } from '@/lib/ads'
import { adSearches, DISCOVERY_LINKS } from '@/lib/research'
import { Button, Card, Empty, Note, Skeleton, Stat } from '@/components/ui'

const STATUSES: CampaignStatus[] = ['testing', 'scaling', 'paused', 'killed']

const VERDICT_STYLE: Record<string, string> = {
  winning: 'border-moss-500 bg-moss-50',
  marginal: 'border-ink-300 bg-sand-100',
  losing: 'border-clay-500 bg-clay-50',
  'too-early': 'border-ink-200 bg-white',
  'no-data': 'border-ink-200 bg-white',
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0.00"
        className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
      />
    </label>
  )
}

export default function AdsPage() {
  const { data, ready, addCampaign, updateCampaign, removeCampaign, addEntry } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [product, setProduct] = useState('')
  const [spend, setSpend] = useState('')
  const [revenue, setRevenue] = useState('')
  const [purchases, setPurchases] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [alsoBooks, setAlsoBooks] = useState(true)
  const [research, setResearch] = useState('')

  const totals = useMemo(() => totalsAcross(data.campaigns), [data.campaigns])
  const links = useMemo(() => adSearches(research), [research])

  if (!ready) return <Skeleton />

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const spendCents = toCents(spend)
    addCampaign({
      name: name.trim(),
      product: product.trim() || name.trim(),
      platform: 'meta',
      status: 'testing',
      spendCents,
      revenueCents: toCents(revenue),
      purchases: Number(purchases) || 0,
      unitCostCents: toCents(unitCost),
      startedAt: today(),
    })
    // One entry, two places, no double counting: the books only get this if you
    // say so, and the checkbox says exactly what it does.
    if (alsoBooks && spendCents > 0) {
      addEntry({
        day: today(),
        kind: 'expense',
        label: `Ads — ${name.trim()}`,
        category: 'Ads',
        amountCents: spendCents,
      })
    }
    setName('')
    setProduct('')
    setSpend('')
    setRevenue('')
    setPurchases('')
    setUnitCost('')
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ads</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          Ads Manager shows you ROAS without knowing what your goods cost. Put the numbers in here
          and it will tell you whether a campaign is actually making money.
        </p>
      </div>

      {data.campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Spent" value={formatMoney(totals.spendCents)} />
          <Stat label="Back" value={formatMoney(totals.revenueCents)} />
          <Stat
            label="Net"
            value={formatMoney(totals.netProfitCents)}
            tone={totals.netProfitCents >= 0 ? 'good' : 'bad'}
            sub={totals.roas !== null ? `${totals.roas.toFixed(2)}× blended` : undefined}
          />
        </div>
      )}

      {open ? (
        <Card title="New campaign">
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-700">Campaign name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                placeholder="Sleep mask — broad UK"
                className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-700">Product</span>
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                maxLength={80}
                placeholder="Weighted sleep mask"
                className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Money label="Spent so far" value={spend} onChange={setSpend} />
              <Money label="Revenue" value={revenue} onChange={setRevenue} />
              <label className="block">
                <span className="text-xs font-medium text-ink-700">Purchases</span>
                <input
                  value={purchases}
                  onChange={(e) => setPurchases(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
                />
              </label>
              <Money label="Cost per unit" value={unitCost} onChange={setUnitCost} />
            </div>
            <p className="text-xs leading-relaxed text-ink-500">
              Cost per unit is what you pay your supplier for one order, shipping included. Without
              it, ROAS cannot tell you anything about profit.
            </p>
            <label className="flex items-start gap-2.5 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={alsoBooks}
                onChange={(e) => setAlsoBooks(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded accent-moss-600"
              />
              <span>Also record this spend in Money, so the books stay complete</span>
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
        <Button onClick={() => setOpen(true)}>Add a campaign</Button>
      )}

      {data.campaigns.length === 0 ? (
        <Empty
          title="No campaigns yet"
          body="Add one with what you have spent, what came back, and what a unit costs you. It will tell you whether to scale it, change it, or stop."
        />
      ) : (
        data.campaigns.map((c) => <CampaignCard key={c.id} campaign={c} onUpdate={updateCampaign} onRemove={removeCampaign} />)
      )}

      <Card title="See what is already running">
        <p className="text-sm leading-relaxed text-ink-600">
          Type a product and these open the right searches. Ads that have been running a long time
          are the ones making money — nobody keeps paying for a loser.
        </p>
        <input
          value={research}
          onChange={(e) => setResearch(e.target.value)}
          placeholder="weighted sleep mask"
          className="mt-3 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
        />
        <div className="mt-3 space-y-2">
          {(links.length > 0 ? links : DISCOVERY_LINKS).map((l) => (
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
      </Card>
    </div>
  )
}

function CampaignCard({
  campaign,
  onUpdate,
  onRemove,
}: {
  campaign: Campaign
  onUpdate: (id: string, patch: Partial<Campaign>) => void
  onRemove: (id: string) => void
}) {
  const m = metricsFor(campaign)
  const a = assess(campaign)
  const [editing, setEditing] = useState(false)
  const [spend, setSpend] = useState((campaign.spendCents / 100).toString())
  const [revenue, setRevenue] = useState((campaign.revenueCents / 100).toString())
  const [purchases, setPurchases] = useState(campaign.purchases.toString())

  function save() {
    onUpdate(campaign.id, {
      spendCents: toCents(spend),
      revenueCents: toCents(revenue),
      purchases: Number(purchases) || 0,
    })
    setEditing(false)
  }

  return (
    <div className={`rounded-2xl border p-5 ${VERDICT_STYLE[a.verdict]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{campaign.name}</p>
          <p className="text-xs text-ink-500">
            {campaign.product} · started {campaign.startedAt}
          </p>
        </div>
        <select
          value={campaign.status}
          onChange={(e) => onUpdate(campaign.id, { status: e.target.value as CampaignStatus })}
          className="shrink-0 rounded-full border border-ink-300 bg-white px-3 py-1.5 text-xs capitalize"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-[0.95rem] font-medium leading-snug text-ink-900">{a.headline}</p>
      <ul className="mt-2 space-y-1.5">
        {a.reasoning.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-700">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-ink-800">
        <strong className="font-medium">Do this:</strong> {a.action}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-500">ROAS</dt>
          <dd className="tabular-nums text-ink-900">{m.roas !== null ? `${m.roas.toFixed(2)}×` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Break even</dt>
          <dd className="tabular-nums text-ink-900">
            {m.breakEvenRoas !== null ? `${m.breakEvenRoas.toFixed(2)}×` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Cost per sale</dt>
          <dd className="tabular-nums text-ink-900">
            {m.cpaCents !== null ? formatMoney(m.cpaCents) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Max you can pay</dt>
          <dd className="tabular-nums text-ink-900">
            {m.maxCpaCents !== null ? formatMoney(m.maxCpaCents) : '—'}
          </dd>
        </div>
      </dl>

      {editing ? (
        <div className="mt-4 space-y-3 border-t border-ink-200 pt-4">
          <div className="grid grid-cols-3 gap-2">
            <Money label="Spent" value={spend} onChange={setSpend} />
            <Money label="Revenue" value={revenue} onChange={setRevenue} />
            <label className="block">
              <span className="text-xs font-medium text-ink-700">Purchases</span>
              <input
                value={purchases}
                onChange={(e) => setPurchases(e.target.value)}
                inputMode="numeric"
                className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>Update</Button>
            <Button variant="quiet" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-200 pt-4">
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Update numbers
          </Button>
          <button
            onClick={() => onRemove(campaign.id)}
            className="min-h-11 px-3 text-sm text-ink-500 hover:text-clay-600"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
