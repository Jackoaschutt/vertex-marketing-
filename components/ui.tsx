import type { ReactNode } from 'react'

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      {title && (
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-500">{title}</h2>
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
  tone?: 'neutral' | 'good' | 'bad'
}) {
  const colour = tone === 'good' ? 'text-moss-600' : tone === 'bad' ? 'text-clay-600' : 'text-ink-900'
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-1.5 whitespace-nowrap text-xl tabular-nums sm:text-2xl ${colour}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 p-8 text-center">
      <p className="font-medium text-ink-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-600">{body}</p>
    </div>
  )
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <p
      className={`rounded-xl border p-4 text-sm leading-relaxed ${
        tone === 'warn'
          ? 'border-clay-400 bg-clay-50 text-clay-700'
          : 'border-ink-200 bg-white text-ink-600'
      }`}
    >
      {children}
    </p>
  )
}

export function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
      <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  ...rest
}: { children: ReactNode; variant?: 'primary' | 'quiet' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition disabled:opacity-60 ${
        variant === 'primary'
          ? 'bg-ink-900 text-sand-50 hover:bg-ink-800'
          : 'border border-ink-300 text-ink-700 hover:border-ink-900'
      }`}
    >
      {children}
    </button>
  )
}
