import type { Metadata } from 'next'
import { brand } from '@/lib/commerce/brand'
import { pageMetadata } from '@/lib/commerce/seo'
import { CartView } from '@/components/store/CartView'

export const metadata: Metadata = pageMetadata({
  title: 'Cart',
  description: 'Review your cart before checkout.',
  path: '/store/cart',
  noIndex: true,
})

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <h1 className="commerce-display text-4xl text-ink-900 sm:text-5xl">Cart</h1>
      <div className="mt-10">
        <CartView freeShippingThresholdCents={brand.shipping.freeThresholdCents} />
      </div>
    </div>
  )
}
