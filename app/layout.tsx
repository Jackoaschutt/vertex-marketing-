import type { Metadata } from 'next'
import { Nav } from '@/components/Nav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ledger',
  description: 'Track the money, learn the process.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-sand-50 text-ink-900 antialiased">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">{children}</main>
      </body>
    </html>
  )
}
