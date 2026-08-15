import type { Metadata } from 'next'
import { brand, absoluteUrl, storeUrl } from '@/lib/commerce/brand'
import { jsonLdScript, organizationJsonLd, websiteJsonLd } from '@/lib/commerce/seo'
import { CartProvider } from '@/components/store/CartProvider'
import { Header } from '@/components/store/Header'
import { Footer } from '@/components/store/Footer'

export const metadata: Metadata = {
  metadataBase: new URL(brand.domain),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s | ${brand.name}` },
  description: brand.positioning,
  alternates: { canonical: absoluteUrl(storeUrl('/')) },
  openGraph: {
    type: 'website',
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.positioning,
    url: absoluteUrl(storeUrl('/')),
  },
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="commerce-scope">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd()) }}
      />
      <CartProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink-900 focus:px-5 focus:py-3 focus:text-sm focus:text-sand-100"
        >
          Skip to content
        </a>
        <Header brandName={brand.name} tagline={brand.tagline} />
        <main id="main">{children}</main>
        <Footer />
      </CartProvider>
    </div>
  )
}
