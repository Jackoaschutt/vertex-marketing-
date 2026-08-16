'use client'

import { useMemo, useState } from 'react'
import { useStore, EXPENSE_CATEGORIES, INCOME_CATEGORIES, today, type EntryKind } from '@/lib/store'
import {
  formatMoney,
  formatPercent,
  inMonth,
  monthLabel,
  monthsPresent,
  toCents,
  totalsFor,
} from '@/lib/money'
import { Button, Card, Empty, Note, Skeleton, Stat } from '@/components/ui'

export default function MoneyPage() {
  const { data, ready, addEntry, removeEntry } = useStore()
  const [kind, setKind] = useState<EntryKind>('expense')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<string>('Ads')
  const [day, setDay] = useState(today())
  const [saved, setSaved] = useState(false)

  const months = useMemo(() => monthsPresent(data.entries), [data.entries])
  const [month, setMonth] = useState<string | null>(null)
  const activeMonth = month ?? months[0] ?? today().slice(0, 7)

  const visible = useMemo(
    () => inMonth(data.entries, activeMonth).sort((a, b) => b.day.localeCompare(a.day)),
    [data.entries, activeMonth]
  )
  const totals = useMemo(() => totalsFor(visible), [visible])

  const categories = kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = toCents(amount)
    if (cents <= 0 || !label.trim()) return
    addEntry({
      day,
      kind,
      label: label.trim(),
      category: categories.includes(category as never) ? category : categories[0],
      amountCents: cents,
    })
    setAmount('')
    setLabel('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  if (!ready) return <Skeleton />

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Money</h1>

      <Card title="Add">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2">
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k)
                  setCategory(k === 'expense' ? 'Ads' : 'Sales')
                }}
                className={`min-h-11 flex-1 rounded-full text-sm font-medium capitalize transition ${
                  kind === k ? 'bg-ink-900 text-sand-50' : 'border border-ink-300 text-ink-700'
                }`}
              >
                {k === 'expense' ? 'Spent' : 'Earned'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-700">Amount</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                required
                className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-700">Date</span>
              <input
                type="date"
                value={day}
                max={today()}
                onChange={(e) => setDay(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-ink-700">What was it</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={kind === 'expense' ? 'Meta ads — sleep mask test' : 'Shopify payout'}
              required
              maxLength={100}
              className="mt-1 h-12 w-full rounded-xl border border-ink-300 bg-white px-3 text-base"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`min-h-10 rounded-full px-3.5 text-sm transition ${
                  category === c
                    ? 'bg-ink-900 text-sand-50'
                    : 'border border-ink-300 text-ink-700 hover:border-ink-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit">Add</Button>
            {saved && <span className="text-sm text-moss-600">Saved</span>}
          </div>
        </form>
      </Card>

      {data.entries.length === 0 ? (
        <Empty
          title="Nothing recorded yet"
          body="Add what you have spent so far, even roughly. Everything else in here is built from these numbers."
        />
      ) : (
        <>
          {months.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-sm transition ${
                    activeMonth === m
                      ? 'bg-ink-900 text-sand-50'
                      : 'border border-ink-300 text-ink-700'
                  }`}
                >
                  {monthLabel(m)}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Stat label="In" value={formatMoney(totals.incomeCents)} />
            <Stat label="Out" value={formatMoney(totals.expenseCents)} />
            <Stat
              label="Left"
              value={formatMoney(totals.profitCents)}
              tone={totals.profitCents >= 0 ? 'good' : 'bad'}
              sub={totals.margin !== null ? `${formatPercent(totals.margin)} margin` : undefined}
            />
          </div>

          {totals.byCategory.length > 0 && (
            <Card title="Where it went">
              <ul className="space-y-2">
                {totals.byCategory.map((c) => {
                  const share = totals.expenseCents > 0 ? c.cents / totals.expenseCents : 0
                  return (
                    <li key={c.category}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-ink-700">{c.category}</span>
                        <span className="tabular-nums text-ink-900">{formatMoney(c.cents)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-ink-400"
                          style={{ width: `${Math.max(2, share * 100)}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card title={`${monthLabel(activeMonth)} — ${visible.length} ${visible.length === 1 ? 'entry' : 'entries'}`}>
            {visible.length === 0 ? (
              <Note>Nothing recorded in this month.</Note>
            ) : (
              <ul className="divide-y divide-ink-100">
                {visible.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-900">{e.label}</p>
                      <p className="text-xs text-ink-500">
                        {e.day} · {e.category}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 tabular-nums text-sm ${
                        e.kind === 'income' ? 'text-moss-600' : 'text-ink-900'
                      }`}
                    >
                      {e.kind === 'income' ? '+' : '−'}
                      {formatMoney(e.amountCents)}
                    </span>
                    <button
                      onClick={() => removeEntry(e.id)}
                      aria-label={`Delete ${e.label}`}
                      className="shrink-0 rounded-full px-2 py-1 text-xs text-ink-400 hover:text-clay-600"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
