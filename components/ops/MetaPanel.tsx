'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/commerce/money'

interface Campaign {
  id: string
  name: string
  status: string
  objective: string
  dailyBudgetCents: number | null
  productId: string | null
  attributedBy: 'map' | 'name' | 'none'
}

interface StatusResponse {
  configured: boolean
  reachable?: boolean
  apiVersion?: string
  requires?: string[]
  message?: string
  error?: string
  hint?: string
  code?: number
  account?: {
    id: string
    name: string
    currency: string
    timezone: string
    statusLabel: string
  }
  currencyMatchesStore?: boolean
  storeCurrency?: string
  canSpend?: boolean
  campaigns?: Campaign[]
  unattributedCampaigns?: number
}

interface ImportSummary {
  from: string
  to: string
  rowsFetched: number
  rowsWritten: number
  attributed: number
  unattributed: number
  spendCents: number
  purchases: number
  revenueCents: number
  unattributedCampaigns: { campaignRef: string; spendCents: number }[]
  note?: string
}

const field =
  'mt-1 w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-ink-900'

export function MetaPanel({
  products,
  sellableProducts,
  currency,
}: {
  products: { id: string; name: string }[]
  sellableProducts: { id: string; name: string; slug: string }[]
  currency: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [launch, setLaunch] = useState<Record<string, unknown> | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/commerce/marketing/meta/status')
      setStatus(await res.json())
    } catch {
      setStatus({ configured: false, message: 'Could not reach the status endpoint.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function runImport(days: number) {
    setBusy(`import-${days}`)
    setMessage(null)
    setSummary(null)
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    try {
      const res = await fetch('/api/commerce/marketing/meta/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ tone: 'err', text: `${data.error}${data.hint ? ` — ${data.hint}` : ''}` })
        return
      }
      setSummary(data)
      router.refresh()
    } catch {
      setMessage({ tone: 'err', text: 'Import request failed.' })
    } finally {
      setBusy(null)
    }
  }

  async function mapCampaign(campaignId: string, productId: string) {
    setBusy(`map-${campaignId}`)
    setMessage(null)
    try {
      const res = await fetch('/api/commerce/marketing/meta/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, productId: productId || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ tone: 'err', text: data.error })
        return
      }
      setMessage({
        tone: 'ok',
        text: productId
          ? `Mapped to ${data.productName}. Re-import the period you want re-attributed.`
          : 'Mapping removed.',
      })
      await loadStatus()
    } finally {
      setBusy(null)
    }
  }

  async function createCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy('launch')
    setMessage(null)
    setLaunch(null)
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/commerce/marketing/meta/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.get('productId'),
          dailyBudgetCents: Math.round(Number(form.get('dailyBudget') ?? 0) * 100),
          headline: form.get('headline'),
          body: form.get('body'),
          interests: String(form.get('interests') ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          countries: String(form.get('countries') ?? 'US')
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({
          tone: 'err',
          text: `${data.error}${data.hint ? ` — ${data.hint}` : ''}${
            Array.isArray(data.issues) ? ` ${data.issues.join(' ')}` : ''
          }`,
        })
        return
      }
      setLaunch(data)
      await loadStatus()
    } catch {
      setMessage({ tone: 'err', text: 'Campaign request failed.' })
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Checking Meta connection…</p>

  // --- Not configured ------------------------------------------------------
  if (!status?.configured) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-600">{status?.message}</p>
        {status?.requires && (
          <p className="flex flex-wrap gap-1.5 text-xs text-ink-500">
            <span>Set:</span>
            {status.requires.map((r) => (
              <code key={r} className="rounded bg-ink-100 px-1">
                {r}
              </code>
            ))}
          </p>
        )}
      </div>
    )
  }

  // --- Configured but unreachable -----------------------------------------
  if (status.reachable === false) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm leading-relaxed text-danger-600">
          <strong>Meta rejected the connection.</strong> {status.error}
          {status.code !== undefined && <span className="opacity-70"> (code {status.code})</span>}
        </p>
        {status.hint && <p className="text-sm leading-relaxed text-ink-600">{status.hint}</p>}
        <p className="text-xs text-ink-500">Graph API version in use: {status.apiVersion}</p>
        <button type="button" onClick={loadStatus} className="min-h-10 rounded-full border border-ink-300 px-4 text-sm text-ink-700">
          Re-check
        </button>
      </div>
    )
  }

  const account = status.account
  const campaigns = status.campaigns ?? []

  return (
    <div className="space-y-6">
      {/* Account ---------------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-ink-200 p-3">
          <p className="commerce-eyebrow text-ink-500">Account</p>
          <p className="mt-1 text-sm text-ink-900">{account?.name}</p>
          <p className="text-xs text-ink-500">{account?.id}</p>
        </div>
        <div className="rounded-xl border border-ink-200 p-3">
          <p className="commerce-eyebrow text-ink-500">Status</p>
          <p className={`mt-1 text-sm ${status.canSpend ? 'text-moss-500' : 'text-clay-600'}`}>
            {account?.statusLabel}
          </p>
          <p className="text-xs text-ink-500">{status.canSpend ? 'Can spend' : 'Cannot spend'}</p>
        </div>
        <div className="rounded-xl border border-ink-200 p-3">
          <p className="commerce-eyebrow text-ink-500">Currency</p>
          <p className={`mt-1 text-sm ${status.currencyMatchesStore ? 'text-ink-900' : 'text-clay-600'}`}>
            {account?.currency}
          </p>
          <p className="text-xs text-ink-500">
            {status.currencyMatchesStore
              ? 'matches store'
              : `store is ${status.storeCurrency} — figures are NOT converted`}
          </p>
        </div>
        <div className="rounded-xl border border-ink-200 p-3">
          <p className="commerce-eyebrow text-ink-500">API version</p>
          <p className="mt-1 text-sm text-ink-900">{status.apiVersion}</p>
          <p className="text-xs text-ink-500">{account?.timezone}</p>
        </div>
      </div>

      {status.currencyMatchesStore === false && (
        <p className="rounded-xl border border-clay-500/40 bg-clay-400/10 p-4 text-sm leading-relaxed text-clay-600">
          The ad account bills in {account?.currency} but the store sells in {status.storeCurrency}.
          Imported spend is <strong>not</strong> currency-converted, so ROAS and CPA will be wrong
          until one of the two is changed or a conversion step is added.
        </p>
      )}

      {/* Import ------------------------------------------------------------ */}
      <div>
        <p className="commerce-eyebrow text-ink-500">Import daily performance</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => runImport(days)}
              disabled={busy !== null}
              className="min-h-10 rounded-full bg-ink-900 px-4 text-sm font-medium text-sand-100 transition hover:bg-ink-800 disabled:bg-ink-300"
            >
              {busy === `import-${days}` ? 'Importing…' : `Last ${days} days`}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-500">
          Idempotent — re-importing a window corrects it rather than double-counting. Rows are keyed
          on (product, channel, campaign, day).
        </p>

        {summary && (
          <div className="mt-3 rounded-xl border border-ink-200 bg-sand-50 p-4 text-sm">
            <p className="text-ink-900">
              {summary.rowsWritten} row(s) written for {summary.from} → {summary.to}:{' '}
              {formatMoney(summary.spendCents, currency)} spend, {summary.purchases} purchase(s),{' '}
              {formatMoney(summary.revenueCents, currency)} attributed revenue.
            </p>
            <p className="mt-1 text-ink-600">
              {summary.attributed} attributed to a product · {summary.unattributed} unattributed
            </p>
            {summary.note && <p className="mt-2 text-clay-600">{summary.note}</p>}
            {summary.unattributedCampaigns.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-ink-600">
                {summary.unattributedCampaigns.slice(0, 5).map((c) => (
                  <li key={c.campaignRef}>
                    {c.campaignRef}: {formatMoney(c.spendCents, currency)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Campaigns --------------------------------------------------------- */}
      <div>
        <p className="commerce-eyebrow text-ink-500">Campaigns ({campaigns.length})</p>
        {campaigns.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">No campaigns in this ad account yet.</p>
        ) : (
          <div className="-mx-5 mt-2 overflow-x-auto px-5">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left">
                  {['Campaign', 'Status', 'Daily budget', 'Attributed to', 'Map to product'].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium text-ink-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {campaigns.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="py-2.5 pr-4">
                      <p className="text-ink-900">{c.name}</p>
                      <p className="text-xs text-ink-500">{c.id}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-ink-700">{c.status}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-ink-900">
                      {c.dailyBudgetCents === null ? '—' : formatMoney(c.dailyBudgetCents, currency)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {c.attributedBy === 'none' ? (
                        <span className="text-clay-600">unattributed</span>
                      ) : (
                        <span className="text-moss-500">
                          {products.find((p) => p.id === c.productId)?.name ?? c.productId}
                          <span className="ml-1 text-xs text-ink-500">
                            ({c.attributedBy === 'map' ? 'mapped' : 'by name'})
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <select
                        defaultValue={c.attributedBy === 'map' ? (c.productId ?? '') : ''}
                        disabled={busy !== null}
                        onChange={(e) => mapCampaign(c.id, e.target.value)}
                        className="min-h-9 rounded-lg border border-ink-300 bg-white px-2 text-xs text-ink-900"
                      >
                        <option value="">— none —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Launch ------------------------------------------------------------ */}
      <div>
        <p className="commerce-eyebrow text-ink-500">Launch a campaign</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          Creates campaign → ad set → creative → ad, all <strong>PAUSED</strong>. Nothing starts
          spending until you activate it in Ads Manager. Only published, sellable products can be
          advertised.
        </p>

        {sellableProducts.length === 0 ? (
          <p className="mt-3 text-sm text-ink-600">
            No published products to advertise yet. Publish one in /ops/products first.
          </p>
        ) : (
          <form onSubmit={createCampaign} className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-ink-600">
              Product
              <select name="productId" className={field} required>
                {sellableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ink-600">
              Daily budget ({currency})
              <input name="dailyBudget" inputMode="decimal" defaultValue="20.00" className={field} required />
            </label>
            <label className="text-sm text-ink-600">
              Headline (max 40 chars)
              <input name="headline" maxLength={40} className={field} required />
            </label>
            <label className="text-sm text-ink-600">
              Countries (comma separated)
              <input name="countries" defaultValue="US" className={field} />
            </label>
            <label className="text-sm text-ink-600 sm:col-span-2">
              Primary text
              <textarea name="body" rows={3} maxLength={500} className={field} required />
            </label>
            <label className="text-sm text-ink-600 sm:col-span-2">
              Interests (comma separated — resolved to real Meta targeting IDs; unmatched ones are dropped)
              <input name="interests" placeholder="Sleep, Interior design" className={field} />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy !== null}
                className="min-h-11 rounded-full bg-ink-900 px-5 text-sm font-medium text-sand-100 transition hover:bg-ink-800 disabled:bg-ink-300"
              >
                {busy === 'launch' ? 'Creating…' : 'Create paused campaign'}
              </button>
            </div>
          </form>
        )}

        {launch && (
          <div className="mt-3 rounded-xl border border-moss-400/40 bg-moss-400/10 p-4 text-sm">
            <p className="text-ink-900">
              Created <strong>{String(launch.campaignName)}</strong> — status{' '}
              {String(launch.status)}.
            </p>
            <p className="mt-1 text-xs text-ink-600">
              campaign {String(launch.campaignId)} · ad set {String(launch.adSetId)} · ad{' '}
              {String(launch.adId)}
            </p>
            {Boolean(launch.warning) && <p className="mt-2 text-clay-600">{String(launch.warning)}</p>}
            <p className="mt-2 text-ink-600">{String(launch.note)}</p>
            <a
              href={String(launch.adsManagerUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-ink-900 underline underline-offset-4"
            >
              Open in Ads Manager
            </a>
          </div>
        )}
      </div>

      {message && (
        <p className={`text-sm ${message.tone === 'ok' ? 'text-moss-500' : 'text-clay-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
