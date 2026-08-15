/**
 * SEO helpers — metadata and JSON-LD.
 *
 * AggregateRating is emitted only when genuine review data exists. There is no
 * review system yet, so it is never emitted. Fabricating star ratings in
 * structured data is both dishonest and a manual-action risk.
 */

import type { Metadata } from 'next'
import { absoluteUrl, brand, storeUrl } from './brand'
import type { ProductDetail } from './types'

export function pageMetadata(opts: {
  title: string
  description: string
  path: string
  image?: string
  noIndex?: boolean
}): Metadata {
  const url = absoluteUrl(opts.path)
  const title = opts.title.includes(brand.name) ? opts.title : `${opts.title} | ${brand.name}`
  return {
    title,
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: 'website',
      title,
      description: opts.description,
      url,
      siteName: brand.name,
      images: opts.image ? [{ url: absoluteUrl(opts.image) }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: opts.description,
      images: opts.image ? [absoluteUrl(opts.image)] : undefined,
    },
  }
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    legalName: brand.legalName,
    url: absoluteUrl(storeUrl('/')),
    description: brand.positioning,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: brand.contact.supportEmail,
      },
    ],
  }
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand.name,
    url: absoluteUrl(storeUrl('/')),
  }
}

export function productJsonLd(detail: ProductDetail): Record<string, unknown> {
  const { product, variants, images } = detail
  const inStock = variants.some((v) => v.stock === null || v.stock > 0)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.tagline ?? product.meta_description ?? product.name,
    sku: variants[0]?.sku,
    brand: { '@type': 'Brand', name: brand.name },
    image: images.map((i) => absoluteUrl(i.url)),
    url: absoluteUrl(storeUrl(`/product/${product.slug}`)),
    offers: {
      '@type': 'Offer',
      price: (product.price_cents / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: absoluteUrl(storeUrl(`/product/${product.slug}`)),
    },
    // No aggregateRating: there is no review data, and inventing one would be
    // both false and a structured-data policy violation.
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function faqJsonLd(faq: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

/** Renders JSON-LD safely. `</` is escaped so a payload cannot close the tag. */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
