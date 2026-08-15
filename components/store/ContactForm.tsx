'use client'

import { useState } from 'react'

export function ContactForm({ responseWindow }: { responseWindow: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/commerce/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          subject: form.get('subject'),
          message: form.get('message'),
          company: form.get('company'),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          Array.isArray(data.issues) && data.issues.length > 0
            ? data.issues.join(' ')
            : (data.error ?? 'Could not send your message.')
        )
        setStatus('idle')
        return
      }
      setStatus('sent')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border border-ink-200 bg-sand-50 p-6">
        <p className="commerce-display text-2xl text-ink-900">Message received</p>
        <p className="mt-2 text-[0.95rem] text-ink-600">
          We reply {responseWindow}. If it is about an order, have the order number to hand.
        </p>
      </div>
    )
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-ink-300 bg-white px-4 py-3 text-[0.95rem] text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-ink-900'

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="email" className="commerce-eyebrow text-ink-500">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} placeholder="you@example.com" />
      </div>

      <div>
        <label htmlFor="subject" className="commerce-eyebrow text-ink-500">
          Subject
        </label>
        <input id="subject" name="subject" type="text" required maxLength={140} className={field} placeholder="Order VSP-… / a question about…" />
      </div>

      <div>
        <label htmlFor="message" className="commerce-eyebrow text-ink-500">
          Message
        </label>
        <textarea id="message" name="message" required rows={6} maxLength={4000} className={field} placeholder="What can we help with?" />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-clay-500/40 bg-clay-400/10 p-3 text-sm text-clay-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-ink-900 px-6 text-[0.95rem] font-medium text-sand-100 transition hover:bg-ink-800 disabled:bg-ink-300 sm:w-auto"
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
