'use client'

import Link from 'next/link'
import { useMemo, useRef } from 'react'
import { useStore } from '@/lib/store'
import { formatMoney, inMonth, monthLabel, totalsFor } from '@/lib/money'
import { completedCount, TOTAL_STEPS } from '@/lib/learn'
import { nudges } from '@/lib/coach'
import { Button, Card, Note, Skeleton, Stat } from '@/components/ui'

export default function Home() {
  const { data, ready, exportData, importData } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)

  const month = new Date().toISOString().slice(0, 7)
  const monthTotals = useMemo(() => totalsFor(inMonth(data.entries, month)), [data.entries, month])
  const allTotals = useMemo(() => totalsFor(data.entries), [data.entries])
  const tips = useMemo(() => (ready ? nudges(data) : []), [data, ready])

  if (!ready) return <Skeleton />

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const result = importData(await file.text())
    if (!result.ok) alert(result.error)
    e.target.value = ''
  }

  const done = completedCount(data.checklist)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {monthLabel(month)}
        </h1>
        <p className="mt-1 text-sm text-ink-600">Everything is saved on this device.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="In" value={formatMoney(monthTotals.incomeCents)} />
        <Stat label="Out" value={formatMoney(monthTotals.expenseCents)} />
        <Stat
          label="Left"
          value={formatMoney(monthTotals.profitCents)}
          tone={monthTotals.profitCents >= 0 ? 'good' : 'bad'}
        />
      </div>

      {tips.map((tip, i) => (
        <Note key={i} tone="warn">
          {tip}
        </Note>
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/money" className="block">
          <Card>
            <p className="font-medium text-ink-900">Add money</p>
            <p className="mt-1 text-sm text-ink-600">
              {data.entries.length === 0
                ? 'Nothing recorded yet'
                : `${data.entries.length} entries · ${formatMoney(allTotals.profitCents)} all time`}
            </p>
          </Card>
        </Link>
        <Link href="/learn" className="block">
          <Card>
            <p className="font-medium text-ink-900">Learn</p>
            <p className="mt-1 text-sm text-ink-600">
              {done} of {TOTAL_STEPS} steps · {data.notes.length} note
              {data.notes.length === 1 ? '' : 's'}
            </p>
          </Card>
        </Link>
      </div>

      <Card title="Your data">
        <p className="text-sm leading-relaxed text-ink-600">
          This all lives in this browser, on this device. Nothing is uploaded anywhere — which also
          means clearing your browsing data would erase it. Take a backup now and then.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={exportData} variant="quiet">
            Export backup
          </Button>
          <Button onClick={() => fileInput.current?.click()} variant="quiet">
            Restore
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            onChange={onFile}
            className="hidden"
          />
        </div>
        <p className="mt-3 text-xs text-ink-500">
          {data.lastExportAt
            ? `Last backup ${data.lastExportAt}.`
            : 'No backup taken yet.'}
        </p>
      </Card>
    </div>
  )
}
