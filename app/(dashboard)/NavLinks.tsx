'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/settings', label: 'Settings' },
]

export default function NavLinks() {
  const pathname = usePathname()

  return (
    <ul className="space-y-1">
      {links.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <li key={href}>
            <Link
              href={href}
              className={`block px-4 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sky-950 text-sky-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
