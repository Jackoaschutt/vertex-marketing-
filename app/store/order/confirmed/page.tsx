import type { Metadata } from 'next'
import Link from 'next/link'
import { brand } from '@/lib/commerce/brand'
import { formatMoney } from '@/lib/commerce/money'
import { pageMetadata } from '@/lib/commerce/seo'
import { getOrderByStripeSession, listOrderItems } from '@/lib/commerce/db/repo'
import { ClearCartOnMount } from '@/components/store/ClearCartOnMount'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Order confirmed',
  description: 'Your order has been received.',
  path: '/store/order/confirmed',
  noIndex: true,
})

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams
  const order = sessionId ? await getOrderByStripeSession(sessionId) : null
  const items = order ? await listOrderItems(order.id) : []

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-24">
      <ClearCartOnMount active={Boolean(sessionId)} />

      <p className="commerce-eyebrow text-ink-500">Thank you</p>
      <h1 className="commerce-display mt-3 text-4xl text-ink-900 sm:text-5xl">
        {order ? `Order ${order.order_number} confirmed` : 'Payment received'}
      </h1>

      {order ? (
        <>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-ink-700">
            A confirmation is on its way to {order.email}. It leaves our supplier in{' '}
            {brand.shipping.processingDays} and we will email a tracking number the moment it ships.
          </p>

          <ul className="mt-10 divide-y divide-ink-200 border-y border-ink-200">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-4 text-[0.95rem]">
                <span className="text-ink-800">
                  {item.title}
                  <span className="text-ink-500"> × {item.quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-900">
                  {formatMoney(item.unit_price_cents * item.quantity, order.currency)}
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-4 py-4 text-base font-medium">
              <span className="text-ink-900">Total</span>
              <span className="tabular-nums text-ink-900">
                {formatMoney(order.total_cents, order.currency)}
              </span>
            </li>
          </ul>
        </>
      ) : (
        <p className="mt-5 text-[1.05rem] leading-relaxed text-ink-700">
          {sessionId
            ? 'Your payment went through. We are still recording the order — this normally takes a few seconds. Your confirmation email will arrive shortly; if it does not, get in touch and we will find it.'
            : 'This page confirms an order after checkout. If you arrived here directly, there is nothing to show.'}
        </p>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/store/shop"
          className="inline-flex min-h-[3.25rem] items-center rounded-full bg-ink-900 px-7 text-[0.95rem] font-medium text-sand-100 transition hover:bg-ink-800"
        >
          Keep looking
        </Link>
        <Link
          href="/store/contact"
          className="inline-flex min-h-[3.25rem] items-center rounded-full border border-ink-900 px-7 text-[0.95rem] font-medium text-ink-900 transition hover:bg-ink-900 hover:text-sand-100"
        >
          Contact support
        </Link>
      </div>
    </div>
  )
}
