import Image from 'next/image'
import Link from 'next/link'
import { brand } from '@/lib/commerce/brand'
import { config } from '@/lib/commerce/config'
import { listImagesForProducts, listProducts } from '@/lib/commerce/db/repo'
import { isSellable } from '@/lib/commerce/research/scoring'
import { ProductCard } from '@/components/store/ProductCard'

export const revalidate = 300

export default async function StoreHome() {
  const all = await listProducts({ published: true, sort: 'position' })
  const products = all.filter((p) => isSellable(p.status))
  const images = await listImagesForProducts(products.map((p) => p.id))
  const imageFor = (id: string) => images.find((i) => i.product_id === id)

  const featured = products.filter((p) => p.featured).slice(0, 2)
  const hero = featured[0] ?? products[0]
  const rest = products.filter((p) => p.id !== hero?.id).slice(0, 6)

  return (
    <>
      {/* Hero ------------------------------------------------------------ */}
      <section className="border-b border-ink-200">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <p className="commerce-eyebrow text-ink-500">{brand.tagline}</p>
            <h1 className="commerce-display mt-4 text-[2.6rem] text-ink-900 sm:text-6xl">
              Considered objects
              <br />
              for winding down.
            </h1>
            <p className="mt-6 max-w-prose text-[1.05rem] leading-relaxed text-ink-700">
              {brand.promise}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/store/shop"
                className="inline-flex min-h-[3.25rem] items-center rounded-full bg-ink-900 px-7 text-[0.95rem] font-medium text-sand-100 transition hover:bg-ink-800"
              >
                Shop everything
              </Link>
              {hero && (
                <Link
                  href={`/store/product/${hero.slug}`}
                  className="inline-flex min-h-[3.25rem] items-center rounded-full border border-ink-900 px-7 text-[0.95rem] font-medium text-ink-900 transition hover:bg-ink-900 hover:text-sand-100"
                >
                  {hero.name}
                </Link>
              )}
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-sand-200 md:aspect-[4/4.6]">
            {hero && imageFor(hero.id) ? (
              <Image
                src={imageFor(hero.id)!.url}
                alt={imageFor(hero.id)!.alt || hero.name}
                fill
                priority
                sizes="(min-width: 768px) 45vw, 92vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-400">
                Add a product to fill this space
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Positioning ----------------------------------------------------- */}
      <section className="border-b border-ink-200 bg-sand-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {brand.trust.map((item) => (
            <div key={item.title}>
              <p className="text-[0.95rem] font-medium text-ink-900">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories ------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <div className="flex items-end justify-between gap-4">
          <h2 className="commerce-display text-3xl text-ink-900 sm:text-4xl">Where to start</h2>
          <Link href="/store/shop" className="shrink-0 text-sm text-ink-600 underline underline-offset-4 hover:text-ink-900">
            See everything
          </Link>
        </div>
        <div className="commerce-rail mt-8 flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-5">
          {brand.categories.map((c) => (
            <Link
              key={c.slug}
              href={`/store/shop?category=${c.slug}`}
              className="min-w-[15rem] rounded-2xl border border-ink-200 bg-white p-5 transition hover:border-ink-900 sm:min-w-0"
            >
              <p className="text-[0.95rem] font-medium text-ink-900">{c.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Products -------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="commerce-display text-3xl text-ink-900 sm:text-4xl">The short list</h2>
        {products.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-ink-200 bg-sand-50 p-6 text-[0.95rem] text-ink-600">
            No products are published yet. Approve one in the admin at <code>/ops/products</code>, then
            publish it.
            {config.demoMode && ' (Running on demo data — connect Supabase to persist changes.)'}
          </p>
        ) : (
          <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                image={imageFor(product.id)}
                priority={i < 3}
              />
            ))}
          </div>
        )}
      </section>

      {/* Story ----------------------------------------------------------- */}
      <section className="border-t border-ink-200 bg-sand-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-24">
          <p className="commerce-eyebrow text-ink-500">Why we made this</p>
          <p className="commerce-display mt-5 text-[1.75rem] leading-snug text-ink-900 sm:text-4xl">
            The last hour of the day sets up the next one.
          </p>
          <p className="mx-auto mt-6 max-w-prose text-[1.05rem] leading-relaxed text-ink-700">
            Most of what is sold for &ldquo;better sleep&rdquo; is either a mattress or an app. The
            gap in between is a handful of small, physical things that quietly remove friction from
            the end of the day. That gap is the whole brand.
          </p>
          <Link
            href="/store/pages/about"
            className="mt-8 inline-flex min-h-11 items-center text-sm text-ink-900 underline underline-offset-4"
          >
            More about how we choose products
          </Link>
        </div>
      </section>
    </>
  )
}
