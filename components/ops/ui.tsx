import Link from 'next/link'
import type { ReactNode } from 'react'

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-ink-200 bg-white p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="commerce-eyebrow text-ink-500">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'positive' | 'negative'
}) {
  const toneClass =
    tone === 'positive' ? 'text-moss-500' : tone === 'negative' ? 'text-clay-600' : 'text-ink-900'
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <p className="commerce-eyebrow text-ink-500">{label}</p>
      <p className={`mt-2 text-2xl tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}

const BADGE_TONES: Record<string, string> = {
  REAL: 'bg-moss-400/15 text-moss-500 border-moss-400/40',
  MOCK: 'bg-clay-400/15 text-clay-600 border-clay-400/40',
  TODO: 'bg-ink-200 text-ink-600 border-ink-300',
  DEMO: 'bg-clay-400/15 text-clay-600 border-clay-400/40',
  info: 'bg-ink-100 text-ink-700 border-ink-200',
  warning: 'bg-clay-400/15 text-clay-600 border-clay-400/40',
  critical: 'bg-danger-500/15 text-danger-600 border-danger-500/40',
  positive: 'bg-moss-400/15 text-moss-500 border-moss-400/40',
}

export function Badge({ children, tone = 'info' }: { children: ReactNode; tone?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider ${
        BADGE_TONES[tone] ?? BADGE_TONES.info
      }`}
    >
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, string> = {
  researching: 'info',
  validation: 'info',
  approved: 'positive',
  rejected: 'critical',
  testing: 'warning',
  winner: 'positive',
  loser: 'critical',
  scaling: 'positive',
  received: 'info',
  validated: 'info',
  routed: 'info',
  submitted: 'warning',
  fulfilled: 'positive',
  delivered: 'positive',
  needs_attention: 'critical',
  cancelled: 'critical',
  refunded: 'warning',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'info'}>{status.replace(/_/g, ' ')}</Badge>
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left">
            {head.map((h) => (
              <th key={h} className="pb-2.5 pr-4 font-medium text-ink-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  )
}

export function Empty({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 p-8 text-center">
      <p className="text-[0.95rem] font-medium text-ink-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600">{body}</p>
      {href && cta && (
        <Link
          href={href}
          className="mt-5 inline-flex min-h-10 items-center rounded-full border border-ink-900 px-5 text-sm text-ink-900"
        >
          {cta}
        </Link>
      )}
    </div>
  )
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  return (
    <p
      className={`rounded-xl border p-4 text-sm leading-relaxed ${
        tone === 'warning'
          ? 'border-clay-500/40 bg-clay-400/10 text-clay-600'
          : 'border-ink-200 bg-sand-50 text-ink-600'
      }`}
    >
      {children}
    </p>
  )
}
