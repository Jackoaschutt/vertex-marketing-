import Image from 'next/image'
import Link from 'next/link'
import { formatMoney } from '@/lib/commerce/money'
import type { Product, ProductImage } from '@/lib/commerce/types'

export function ProductCard({
  product,
  image,
  priority = false,
  currency = 'USD',
}: {
  product: Product
  image?: ProductImage
  priority?: boolean
  currency?: string
}) {
  const showCompareAt =
    product.compare_at_cents !== null && product.compare_at_cents > product.price_cents

  return (
    <Link href={`/store/product/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand-200">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">
            No image yet
          </div>
        )}
      </div>
      <div className="mt-3.5 flex items-baseline justify-between gap-3">
        <h3 className="text-[0.95rem] font-medium text-ink-900">{product.name}</h3>
        <span className="shrink-0 text-[0.95rem] tabular-nums text-ink-900">
          {formatMoney(product.price_cents, currency)}
          {showCompareAt && (
            <span className="ml-2 text-sm text-ink-400 line-through">
              {formatMoney(product.compare_at_cents!, currency)}
            </span>
          )}
        </span>
      </div>
      {product.tagline && (
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{product.tagline}</p>
      )}
    </Link>
  )
}
