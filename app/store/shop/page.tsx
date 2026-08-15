import type { Metadata } from 'next'
import Link from 'next/link'
import { brand } from '@/lib/commerce/brand'
import { pageMetadata } from '@/lib/commerce/seo'
import { listImagesForProducts, listProducts } from '@/lib/commerce/db/repo'
import { isSellable } from '@/lib/commerce/research/scoring'
import { ProductCard } from '@/components/store/ProductCard'

export const revalidate = 300

export const metadata: Metadata = pageMetadata({
  title: 'Shop',
  description: `Everything ${brand.name} makes — a short list of considered objects for the end of the day.`,
  path: '/store/shop',
})

const SORTS = [
  { key: 'position', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
] as const

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>
}) {
  const params = await searchParams
  const category = params.category
  const sort = (SORTS.find((s) => s.key === params.sort)?.key ?? 'position') as
    | 'position'
    | 'newest'
    | 'price_asc'
    | 'price_desc'

  const all = await listProducts({ published: true, sort })
  const sellable = all.filter((p) => isSellable(p.status))
  const products = category ? sellable.filter((p) => p.category === category) : sellable
  const images = await listImagesForProducts(products.map((p) => p.id))

  const activeCategory = brand.categories.find((c) => c.slug === category)
  const qs = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    const merged = { category, sort: params.sort, ...next }
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    const s = sp.toString()
    return `/store/shop${s ? `?${s}` : ''}`
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <header>
        <h1 className="commerce-display text-4xl text-ink-900 sm:text-5xl">
          {activeCategory ? activeCategory.name : 'Everything we make'}
        </h1>
        <p className="mt-3 max-w-prose text-[1.05rem] leading-relaxed text-ink-600">
          {activeCategory ? activeCategory.blurb : brand.promise}
        </p>
      </header>

      {/* Filters --------------------------------------------------------- */}
      <div className="mt-8 space-y-4 border-y border-ink-200 py-4">
        <div className="commerce-rail flex gap-2 overflow-x-auto">
          <Link
            href={qs({ category: undefined })}
            className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm transition ${
              !category ? 'border-ink-900 bg-ink-900 text-sand-100' : 'border-ink-300 text-ink-700 hover:border-ink-900'
            }`}
          >
            All
          </Link>
          {brand.categories.map((c) => (
            <Link
              key={c.slug}
              href={qs({ category: c.slug })}
              className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                category === c.slug
                  ? 'border-ink-900 bg-ink-900 text-sand-100'
                  : 'border-ink-300 text-ink-700 hover:border-ink-900'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="commerce-rail flex items-center gap-2 overflow-x-auto text-sm">
          <span className="shrink-0 text-ink-500">Sort</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={qs({ sort: s.key === 'position' ? undefined : s.key })}
              className={`shrink-0 rounded-full px-3 py-1.5 transition ${
                sort === s.key ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid ------------------------------------------------------------ */}
      {products.length === 0 ? (
        <div className="py-20 text-center">
          <p className="commerce-display text-2xl text-ink-900">Nothing here yet</p>
          <p className="mx-auto mt-3 max-w-sm text-[0.95rem] text-ink-600">
            {category
              ? 'No products in this category are published right now.'
              : 'No products are published yet.'}
          </p>
          {category && (
            <Link
              href="/store/shop"
              className="mt-6 inline-flex min-h-11 items-center rounded-full border border-ink-900 px-6 text-sm text-ink-900"
            >
              See everything
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-ink-500">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </p>
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                image={images.find((img) => img.product_id === product.id)}
                priority={i < 3}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
