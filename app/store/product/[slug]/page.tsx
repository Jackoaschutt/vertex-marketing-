import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { brand } from '@/lib/commerce/brand'
import { config } from '@/lib/commerce/config'
import { formatMoney } from '@/lib/commerce/money'
import { fallbackContent } from '@/lib/commerce/ai/content'
import { isSellable } from '@/lib/commerce/research/scoring'
import { getProductDetailBySlug, listImagesForProducts, listProducts } from '@/lib/commerce/db/repo'
import {
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLdScript,
  pageMetadata,
  productJsonLd,
} from '@/lib/commerce/seo'
import { ProductActions } from '@/components/store/ProductActions'
import { ProductCard } from '@/components/store/ProductCard'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const detail = await getProductDetailBySlug(slug)
  if (!detail || !detail.product.published) {
    return pageMetadata({
      title: 'Product not found',
      description: 'This product is not available.',
      path: `/store/product/${slug}`,
      noIndex: true,
    })
  }
  const { product, images } = detail
  return pageMetadata({
    title: product.meta_title ?? product.name,
    description:
      product.meta_description ??
      product.tagline ??
      `${product.name} from ${brand.name}. ${brand.returns.windowDays}-day returns.`,
    path: `/store/product/${product.slug}`,
    image: images[0]?.url,
  })
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const detail = await getProductDetailBySlug(slug)
  if (!detail || !detail.product.published || !isSellable(detail.product.status)) notFound()

  const { product, variants, images } = detail
  // Approved AI copy when it exists; otherwise the deterministic scaffold, which
  // is visibly a scaffold rather than invented claims.
  const content =
    detail.content ??
    fallbackContent({
      name: product.name,
      category: product.category,
      tagline: product.tagline,
      problemSolved: product.problem_solved,
      targetAudience: product.target_audience,
      priceCents: product.price_cents,
      costCents: product.cost_cents,
      shipDaysMin: product.ship_days_min,
      shipDaysMax: product.ship_days_max,
    })

  const showCompareAt =
    product.compare_at_cents !== null && product.compare_at_cents > product.price_cents

  const others = (await listProducts({ published: true, sort: 'position' }))
    .filter((p) => p.id !== product.id && isSellable(p.status))
    .slice(0, 3)
  const otherImages = await listImagesForProducts(others.map((p) => p.id))

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd(detail)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd([
              { name: 'Shop', path: '/store/shop' },
              { name: product.name, path: `/store/product/${product.slug}` },
            ])
          ),
        }}
      />
      {content.faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(content.faq)) }}
        />
      )}

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
          <Link href="/store/shop" className="hover:text-ink-900">
            Shop
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink-700">{product.name}</span>
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-14">
          {/* Gallery ---------------------------------------------------- */}
          <div className="space-y-3">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-sand-200">
              {images[0] ? (
                <Image
                  src={images[0].url}
                  alt={images[0].alt || product.name}
                  fill
                  priority
                  sizes="(min-width: 768px) 48vw, 92vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-400">
                  No image yet
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="commerce-rail flex gap-3 overflow-x-auto">
                {images.slice(1).map((img) => (
                  <div
                    key={img.id}
                    className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-sand-200"
                  >
                    <Image src={img.url} alt={img.alt || product.name} fill sizes="96px" className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buy box ---------------------------------------------------- */}
          <div>
            {product.category && (
              <p className="commerce-eyebrow text-ink-500">
                {brand.categories.find((c) => c.slug === product.category)?.name ?? product.category}
              </p>
            )}
            <h1 className="commerce-display mt-2.5 text-4xl text-ink-900 sm:text-5xl">{product.name}</h1>
            <p className="mt-4 max-w-prose text-[1.05rem] leading-relaxed text-ink-700">
              {content.subtitle || product.tagline}
            </p>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-2xl text-ink-900">
                {formatMoney(product.price_cents, config.currency)}
              </span>
              {showCompareAt && (
                <span className="text-base text-ink-400 line-through">
                  {formatMoney(product.compare_at_cents!, config.currency)}
                </span>
              )}
            </div>

            <div className="mt-7">
              <ProductActions
                productName={product.name}
                variants={variants}
                currency={config.currency}
              />
            </div>

            <dl className="mt-8 divide-y divide-ink-200 border-y border-ink-200 text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-600">Delivery</dt>
                <dd className="text-right text-ink-900">
                  {product.ship_days_min}–{product.ship_days_max} business days, tracked
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-600">Returns</dt>
                <dd className="text-right text-ink-900">
                  {brand.returns.windowDays} days, {brand.returns.condition}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-600">Free delivery over</dt>
                <dd className="text-right text-ink-900">
                  {formatMoney(brand.shipping.freeThresholdCents, config.currency)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Story --------------------------------------------------------- */}
        <section className="mt-16 grid gap-12 border-t border-ink-200 pt-14 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-10">
            <div className="max-w-prose space-y-4 text-[1.05rem] leading-relaxed text-ink-700">
              {content.description.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {content.benefits.length > 0 && (
              <div>
                <h2 className="commerce-display text-2xl text-ink-900">What it does</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {content.benefits.map((b) => (
                    <div key={b.heading} className="rounded-2xl border border-ink-200 bg-sand-50 p-5">
                      <p className="text-[0.95rem] font-medium text-ink-900">{b.heading}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{b.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.howItWorks.length > 0 && (
              <div>
                <h2 className="commerce-display text-2xl text-ink-900">How it works</h2>
                <ol className="mt-5 space-y-4">
                  {content.howItWorks.map((step, i) => (
                    <li key={step.step} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-300 text-sm text-ink-700">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-[0.95rem] font-medium text-ink-900">{step.step}</p>
                        <p className="mt-1 text-sm leading-relaxed text-ink-600">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {content.faq.length > 0 && (
              <div>
                <h2 className="commerce-display text-2xl text-ink-900">Questions</h2>
                <div className="mt-5 divide-y divide-ink-200 border-y border-ink-200">
                  {content.faq.map((f) => (
                    <details key={f.question} className="group py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.95rem] font-medium text-ink-900">
                        {f.question}
                        <span className="text-ink-400 transition group-open:rotate-45">+</span>
                      </summary>
                      <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-ink-600">{f.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar ---------------------------------------------------- */}
          <aside className="space-y-6">
            {content.features.length > 0 && (
              <div className="rounded-2xl border border-ink-200 bg-sand-50 p-5">
                <h2 className="commerce-eyebrow text-ink-500">Details</h2>
                <ul className="mt-3 space-y-2 text-sm text-ink-700">
                  {content.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="text-ink-400">
                        —
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {content.specifications.length > 0 && (
              <div className="rounded-2xl border border-ink-200 bg-sand-50 p-5">
                <h2 className="commerce-eyebrow text-ink-500">Specifications</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  {content.specifications.map((s) => (
                    <div key={s.label} className="flex justify-between gap-3">
                      <dt className="text-ink-600">{s.label}</dt>
                      <dd className="text-right text-ink-900">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/*
              Social proof. We have no review system, so rather than fabricating
              ratings we say so plainly. This is a deliberate product decision:
              inventing reviews is the single most common dropshipping tell.
            */}
            <div className="rounded-2xl border border-ink-200 p-5">
              <h2 className="commerce-eyebrow text-ink-500">Reviews</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                We do not show reviews yet, because we do not have enough real ones to be useful — and
                we will not print invented ones. When you have had this a couple of weeks, we will
                email and ask what you actually think.
              </p>
            </div>

            <div className="rounded-2xl border border-ink-200 p-5">
              <h2 className="commerce-eyebrow text-ink-500">Shipping &amp; returns</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                Orders leave our supplier in {brand.shipping.processingDays}. Typical delivery is{' '}
                {product.ship_days_min}–{product.ship_days_max} business days with tracking.
                Returns within {brand.returns.windowDays} days, {brand.returns.condition}.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href="/store/pages/shipping" className="text-ink-900 underline underline-offset-4">
                  Shipping
                </Link>
                <Link href="/store/pages/returns" className="text-ink-900 underline underline-offset-4">
                  Returns
                </Link>
              </div>
            </div>
          </aside>
        </section>

        {/* Related ------------------------------------------------------- */}
        {others.length > 0 && (
          <section className="mt-16 border-t border-ink-200 pt-14">
            <h2 className="commerce-display text-2xl text-ink-900">Also worth a look</h2>
            <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  image={otherImages.find((i) => i.product_id === p.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
