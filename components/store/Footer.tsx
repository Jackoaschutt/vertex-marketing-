import Link from 'next/link'
import { brand } from '@/lib/commerce/brand'

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { href: '/store/shop', label: 'All products' },
      ...brand.categories.map((c) => ({ href: `/store/shop?category=${c.slug}`, label: c.name })),
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/store/pages/faq', label: 'FAQ' },
      { href: '/store/pages/shipping', label: 'Shipping' },
      { href: '/store/pages/returns', label: 'Returns' },
      { href: '/store/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/store/pages/about', label: 'About' },
      { href: '/store/pages/privacy', label: 'Privacy' },
      { href: '/store/pages/terms', label: 'Terms' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-200 bg-sand-50">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="commerce-eyebrow text-ink-900">{brand.name}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-600">{brand.promise}</p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="commerce-eyebrow text-ink-500">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-sm text-ink-700 transition hover:text-ink-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-200 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.legalName}. {brand.contact.addressLines[0]}
          </p>
          <p>{brand.shipping.regions}</p>
        </div>
      </div>
    </footer>
  )
}
