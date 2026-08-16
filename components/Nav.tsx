'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/money', label: 'Money' },
  { href: '/ads', label: 'Ads' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/learn', label: 'Learn' },
  { href: '/coach', label: 'Coach' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 border-b border-ink-200 bg-sand-50/90 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Main">
        <Link href="/" className="mr-2 shrink-0 text-sm font-semibold tracking-tight text-ink-900">
          Ledger
        </Link>
        {LINKS.slice(1).map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`min-h-11 shrink-0 rounded-full px-3.5 text-sm leading-[2.75rem] transition ${
                active ? 'bg-ink-900 text-sand-50' : 'text-ink-600 hover:bg-ink-100'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
