import type { Metadata } from 'next'
import Link from 'next/link'
import { adminDeniedMessage, checkAdmin } from '@/lib/commerce/auth'
import { checkDatabase } from '@/lib/commerce/db/health'
import { brand } from '@/lib/commerce/brand'
import { config } from '@/lib/commerce/config'
import { Badge, Note } from '@/components/ops/ui'

export const metadata: Metadata = {
  title: `${brand.name} Ops`,
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/ops', label: 'Overview' },
  { href: '/ops/books', label: 'Books' },
  { href: '/ops/research', label: 'Research' },
  { href: '/ops/products', label: 'Products' },
  { href: '/ops/playbook', label: 'Playbook' },
  { href: '/ops/postmortems', label: 'Post-mortems' },
  { href: '/ops/analytics', label: 'Analytics' },
  { href: '/ops/marketing', label: 'Marketing' },
  { href: '/ops/suppliers', label: 'Sourcing' },
  { href: '/ops/automations', label: 'Automations' },
  { href: '/ops/settings', label: 'Settings' },
  { href: '/ops/system', label: 'System' },
]

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const admin = await checkAdmin()

  if (!admin.ok) {
    return (
      <div className="commerce-scope flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-8">
          <p className="commerce-eyebrow text-ink-500">{brand.name} Ops</p>
          <h1 className="commerce-display mt-3 text-3xl text-ink-900">Locked</h1>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-700">
            {adminDeniedMessage(admin.reason)}
          </p>
          {admin.reason === 'locked' && (
            <Link
              href="/unlock"
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-sm font-medium text-sand-100"
            >
              Unlock
            </Link>
          )}
          <p className="mt-6 text-xs leading-relaxed text-ink-500">
            An unset <code className="rounded bg-ink-100 px-1">ADMIN_PASSCODE</code> denies
            everyone by design, so a misconfigured deployment never exposes your books.
          </p>
        </div>
      </div>
    )
  }

  // One cheap probe, so a database problem shows a message that names the cause
  // instead of Next's generic "Application error … Digest: 222848690".
  const health = await checkDatabase()

  if (health.status !== 'ok') {
    return (
      <div className="commerce-scope flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-clay-500/40 bg-white p-8">
          <p className="commerce-eyebrow text-clay-600">Database</p>
          <h1 className="commerce-display mt-3 text-3xl text-ink-900">{health.title}</h1>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-700">{health.fix}</p>
          {health.detail && (
            <pre className="mt-5 overflow-x-auto rounded-xl bg-ink-100 p-3 text-xs text-ink-700">
              {health.detail}
            </pre>
          )}
          <p className="mt-5 text-xs leading-relaxed text-ink-500">
            Nothing has been lost. The tool refuses to load rather than show you figures it cannot
            stand behind — an empty dashboard would look like a business with no sales.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="commerce-scope min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/ops" className="commerce-eyebrow text-ink-900">
            {brand.name} Ops
          </Link>
          
          <div className="ml-auto flex items-center gap-2">
            {config.demoMode && <Badge tone="DEMO">Demo data</Badge>}

          </div>
        </div>
        <nav aria-label="Admin" className="commerce-rail mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {config.demoMode && (
          <div className="mb-6">
            <Note tone="warning">
              <strong>Demo mode.</strong> No database is configured, so everything below is seeded
              in-memory data that resets when the server restarts. Nothing you change here is saved.
              Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>,
              then run <code>supabase/migrations/011_commerce_core.sql</code>.
            </Note>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
