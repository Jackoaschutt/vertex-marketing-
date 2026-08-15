'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { formatMoney } from '@/lib/commerce/money'
import { SCORE_FIELDS, type ScoreInput } from '@/lib/commerce/research/scoring'

interface ScoreResult {
  components: Record<string, number>
  total: number
  verdict: 'strong' | 'viable' | 'marginal' | 'skip'
  reasons: string[]
  suggestedStatus: string
}

const COMPONENT_LABELS: [string, string, number][] = [
  ['demand_score', 'Demand', 20],
  ['margin_score', 'Margin', 15],
  ['competition_score', 'Competition', 15],
  ['problem_score', 'Problem / solution', 15],
  ['creative_score', 'Creative potential', 10],
  ['brandability_score', 'Brandability', 10],
  ['shipping_score', 'Shipping', 5],
  ['repeat_score', 'Repeat purchase', 5],
  ['risk_score', 'Risk', 5],
]

const VERDICT_TONE: Record<string, string> = {
  strong: 'text-moss-500',
  viable: 'text-ink-900',
  marginal: 'text-clay-600',
  skip: 'text-danger-600',
}

export function ResearchConsole() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [problem, setProblem] = useState('')
  const [audience, setAudience] = useState('')
  const [supplierUrl, setSupplierUrl] = useState('')
  const [price, setPrice] = useState('49.00')
  const [cost, setCost] = useState('12.00')
  const [ship, setShip] = useState('4.00')
  const [shipDaysMin, setShipDaysMin] = useState(7)
  const [shipDaysMax, setShipDaysMax] = useState(14)

  const [signals, setSignals] = useState<Record<string, number>>(
    Object.fromEntries(SCORE_FIELDS.map((f) => [f.key, 3]))
  )

  const [result, setResult] = useState<ScoreResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const toCents = (s: string) => Math.round((Number(s.replace(/[^0-9.]/g, '')) || 0) * 100)

  const score = useCallback(async () => {
    try {
      const res = await fetch('/api/commerce/research/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceCents: toCents(price),
          costCents: toCents(cost),
          shippingCostCents: toCents(ship),
          shipDaysMax,
          ...signals,
        }),
      })
      if (!res.ok) return
      setResult(await res.json())
    } catch {
      // Live scoring is a convenience; a transient failure is not worth a
      // blocking error message while the operator is still typing.
    }
  }, [price, cost, ship, shipDaysMax, signals])

  useEffect(() => {
    const t = window.setTimeout(() => void score(), 250)
    return () => window.clearTimeout(t)
  }, [score])

  async function save() {
    if (!name.trim()) {
      setMessage({ tone: 'err', text: 'Give the candidate a name first.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/commerce/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          problemSolved: problem,
          targetAudience: audience,
          supplierUrl,
          priceCents: toCents(price),
          costCents: toCents(cost),
          shippingCostCents: toCents(ship),
          shipDaysMin,
          shipDaysMax,
          status: 'researching',
          research: signals,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({
          tone: 'err',
          text: Array.isArray(data.issues) && data.issues.length ? data.issues.join(' ') : data.error,
        })
        return
      }
      setMessage({
        tone: 'ok',
        text: `Saved "${data.product.name}" at ${data.product.product_score}/100. It is unpublished — approve it in Products when you are ready.`,
      })
      setName('')
      router.refresh()
    } catch {
      setMessage({ tone: 'err', text: 'Request failed.' })
    } finally {
      setSaving(false)
    }
  }

  const field =
    'mt-1 w-full rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-ink-900'
  const priceCents = toCents(price)
  const marginPct =
    priceCents > 0 ? ((priceCents - toCents(cost) - toCents(ship)) / priceCents) * 100 : null

  const groups = [...new Set(SCORE_FIELDS.map((f) => f.group))]

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="commerce-eyebrow text-ink-500">Candidate</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-ink-600 sm:col-span-2">
              Product name
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Halo Bedside Light" />
            </label>
            <label className="text-sm text-ink-600">
              Category
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={field} placeholder="light" />
            </label>
            <label className="text-sm text-ink-600">
              Supplier URL
              <input value={supplierUrl} onChange={(e) => setSupplierUrl(e.target.value)} className={field} placeholder="https://…" />
            </label>
            <label className="text-sm text-ink-600 sm:col-span-2">
              Problem it solves
              <input value={problem} onChange={(e) => setProblem(e.target.value)} className={field} placeholder="Overhead lights are too bright to read by at 11pm." />
            </label>
            <label className="text-sm text-ink-600 sm:col-span-2">
              Target audience
              <input value={audience} onChange={(e) => setAudience(e.target.value)} className={field} placeholder="Adults 28–45 who read in bed" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="commerce-eyebrow text-ink-500">Economics</h2>
          <p className="mt-1 text-xs text-ink-500">
            Margin and shipping scores are computed from these numbers, not judged.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-sm text-ink-600">
              Selling price
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={field} />
            </label>
            <label className="text-sm text-ink-600">
              Unit cost
              <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className={field} />
            </label>
            <label className="text-sm text-ink-600">
              Inbound shipping
              <input value={ship} onChange={(e) => setShip(e.target.value)} inputMode="decimal" className={field} />
            </label>
            <label className="text-sm text-ink-600">
              Ship days (min)
              <input
                type="number"
                min={0}
                max={120}
                value={shipDaysMin}
                onChange={(e) => setShipDaysMin(Number(e.target.value))}
                className={field}
              />
            </label>
            <label className="text-sm text-ink-600">
              Ship days (max)
              <input
                type="number"
                min={0}
                max={180}
                value={shipDaysMax}
                onChange={(e) => setShipDaysMax(Number(e.target.value))}
                className={field}
              />
            </label>
            <div className="text-sm text-ink-600">
              Gross margin
              <p className="mt-1 rounded-xl border border-ink-200 bg-sand-50 px-3 py-2 tabular-nums text-ink-900">
                {marginPct === null ? '—' : `${marginPct.toFixed(0)}%`}
                <span className="ml-2 text-xs text-ink-500">
                  {formatMoney(priceCents - toCents(cost) - toCents(ship))}/unit
                </span>
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="commerce-eyebrow text-ink-500">Signals</h2>
          <p className="mt-1 text-xs text-ink-500">0 is worst for the business, 5 is best.</p>
          <div className="mt-4 space-y-6">
            {groups.map((group) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{group}</p>
                <div className="mt-2 space-y-3">
                  {SCORE_FIELDS.filter((f) => f.group === group).map((f) => (
                    <div key={f.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor={`sig-${f.key}`} className="text-sm text-ink-800">
                          {f.label}
                        </label>
                        <span className="text-sm tabular-nums text-ink-900">{signals[f.key]}</span>
                      </div>
                      <input
                        id={`sig-${f.key}`}
                        type="range"
                        min={0}
                        max={5}
                        step={1}
                        value={signals[f.key]}
                        onChange={(e) =>
                          setSignals((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                        }
                        className="mt-1 w-full accent-ink-900"
                      />
                      <p className="text-xs text-ink-500">{f.hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Live score ------------------------------------------------------ */}
      <aside className="h-fit space-y-4 lg:sticky lg:top-6">
        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="commerce-eyebrow text-ink-500">Score</h2>
          <p className="mt-3 text-5xl tabular-nums text-ink-900">
            {result?.total ?? '—'}
            <span className="ml-1 text-xl text-ink-400">/100</span>
          </p>
          {result && (
            <p className={`mt-1 text-sm font-medium uppercase tracking-wider ${VERDICT_TONE[result.verdict]}`}>
              {result.verdict}
            </p>
          )}

          <dl className="mt-5 space-y-1.5 text-sm">
            {COMPONENT_LABELS.map(([key, label, max]) => {
              const value = result?.components[key] ?? 0
              return (
                <div key={key}>
                  <div className="flex justify-between">
                    <dt className="text-ink-600">{label}</dt>
                    <dd className="tabular-nums text-ink-900">
                      {value}
                      <span className="text-ink-400">/{max}</span>
                    </dd>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-ink-800 transition-all"
                      style={{ width: `${(value / max) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </dl>
        </div>

        {result && result.reasons.length > 0 && (
          <div className="rounded-2xl border border-ink-200 bg-sand-50 p-5">
            <h2 className="commerce-eyebrow text-ink-500">What the score is telling you</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-700">
              {result.reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden className="text-ink-400">
                    —
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-11 w-full rounded-full bg-ink-900 px-5 text-sm font-medium text-sand-100 transition hover:bg-ink-800 disabled:bg-ink-300"
        >
          {saving ? 'Saving…' : 'Save candidate'}
        </button>
        <p className="text-xs leading-relaxed text-ink-500">
          Saving records the candidate as <strong>researching</strong> and unpublished. A high score
          never publishes a product on its own.
        </p>

        {message && (
          <p className={`text-sm ${message.tone === 'ok' ? 'text-moss-500' : 'text-clay-600'}`}>
            {message.text}
          </p>
        )}
      </aside>
    </div>
  )
}

export type { ScoreInput }
