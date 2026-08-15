'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useCart } from './CartProvider'

const NAV = [
  { href: '/store/shop', label: 'Shop' },
  { href: '/store/pages/about', label: 'About' },
  { href: '/store/pages/faq', label: 'FAQ' },
  { href: '/store/contact', label: 'Contact' },
]

export function Header({ brandName, tagline }: { brandName: string; tagline: string }) {
  const { count, ready } = useCart()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-sand-100/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="store-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-800 transition hover:bg-ink-100 md:hidden"
        >
          <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" fill="none">
            {open ? (
              <>
                <path d="M2 2l16 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M18 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </>
            ) : (
              <>
                <path d="M0 1h20" stroke="currentColor" strokeWidth="1.6" />
                <path d="M0 7h20" stroke="currentColor" strokeWidth="1.6" />
                <path d="M0 13h13" stroke="currentColor" strokeWidth="1.6" />
              </>
            )}
          </svg>
        </button>

        <Link
          href="/store"
          className="commerce-eyebrow text-[0.8rem] tracking-[0.24em] text-ink-900"
          title={tagline}
        >
          {brandName}
        </Link>

        <nav className="ml-8 hidden items-center gap-7 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm transition hover:text-ink-900 ${
                pathname.startsWith(item.href) ? 'text-ink-900' : 'text-ink-600'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/store/cart"
          className="ml-auto flex h-11 items-center gap-2 rounded-full border border-ink-300 px-4 text-sm text-ink-900 transition hover:border-ink-900"
        >
          Cart
          <span
            aria-live="polite"
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold transition ${
              ready && count > 0 ? 'bg-ink-900 text-sand-100' : 'bg-ink-200 text-ink-600'
            }`}
          >
            {ready ? count : 0}
          </span>
        </Link>
      </div>

      {open && (
        <nav id="store-nav" className="border-t border-ink-200 bg-sand-100 md:hidden" aria-label="Mobile">
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-ink-100 py-3.5 text-base text-ink-800 last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
