import type { Metadata } from 'next'
import { brand } from '@/lib/commerce/brand'
import './globals.css'

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.promise,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
