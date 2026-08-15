'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Small POST-and-refresh button used across the ops screens.
 *
 * Reports the server's answer verbatim — including failures — rather than
 * optimistically claiming success.
 *
 * `resultKind` is a string rather than a render prop because this is a Client
 * Component rendered from Server Components, and functions cannot cross that
 * boundary.
 */
export type ResultKind = 'order-retry' | 'automation-run'

interface RetryResult {
  succeeded: boolean
  result: { submitted: number; skipped: number; failures: { message: string }[] }
}

interface AutomationResult {
  recommendationsCreated: number
  reports: { job: string; checked: number; findings: string[]; errors: string[] }[]
}

function Result({ kind, data }: { kind: ResultKind; data: unknown }) {
  if (kind === 'order-retry') {
    const d = data as RetryResult
    return d.succeeded ? (
      <span className="text-moss-500">
        {d.result.submitted} submitted, {d.result.skipped} already done.
      </span>
    ) : (
      <span className="text-clay-600">
        Still failing: {d.result.failures.map((f) => f.message).join(' | ')}
      </span>
    )
  }

  const d = data as AutomationResult
  return (
    <div className="mt-2 space-y-1">
      <p className="text-ink-700">{d.recommendationsCreated} open recommendation(s).</p>
      {d.reports.map((r) => (
        <p key={r.job}>
          <strong>{r.job}</strong>: {r.checked} checked, {r.findings.length} finding(s)
          {r.errors.length > 0 && <span className="text-clay-600">, {r.errors.length} error(s)</span>}
        </p>
      ))}
    </div>
  )
}

export function ActionButton({
  url,
  label,
  busyLabel = 'Working…',
  body,
  variant = 'secondary',
  confirm,
  resultKind,
}: {
  url: string
  label: string
  busyLabel?: string
  body?: Record<string, unknown>
  variant?: 'primary' | 'secondary'
  confirm?: string
  resultKind?: ResultKind
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<unknown>(null)

  async function run() {
    if (confirm && !window.confirm(confirm)) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status}).`)
        return
      }
      setResult(data)
      router.refresh()
    } catch {
      setError('Request failed — could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={
          variant === 'primary'
            ? 'min-h-10 rounded-full bg-ink-900 px-5 text-sm font-medium text-sand-100 transition hover:bg-ink-800 disabled:bg-ink-300'
            : 'min-h-10 rounded-full border border-ink-300 px-4 text-sm text-ink-700 transition hover:border-ink-900 disabled:opacity-40'
        }
      >
        {busy ? busyLabel : label}
      </button>
      {error && <p className="text-xs text-clay-600">{error}</p>}
      {result !== null && resultKind && (
        <div className="text-xs text-ink-600">
          <Result kind={resultKind} data={result} />
        </div>
      )}
    </div>
  )
}
