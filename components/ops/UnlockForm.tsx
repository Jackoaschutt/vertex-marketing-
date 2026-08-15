'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function UnlockForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const passcode = String(new FormData(e.currentTarget).get('passcode') ?? '')

    try {
      const res = await fetch('/api/commerce/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'That did not work.')
        return
      }
      // Full navigation rather than a client push, so the middleware re-runs
      // against the freshly-set cookie.
      window.location.href = '/ops'
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="sr-only">Passcode</span>
        <input
          name="passcode"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Passcode"
          className="h-12 w-full rounded-xl border border-ink-300 bg-white px-4 text-sm text-ink-900"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ink-900 text-sm font-medium text-sand-100 disabled:opacity-60"
      >
        {busy ? 'Checking…' : 'Unlock'}
      </button>
      {error && (
        <p className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-600">
          {error}
        </p>
      )}
    </form>
  )
}
