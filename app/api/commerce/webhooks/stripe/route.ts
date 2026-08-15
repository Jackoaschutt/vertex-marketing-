import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { config } from '@/lib/commerce/config'
import { createOrderFromCart } from '@/lib/commerce/orders/create'
import { processOrder } from '@/lib/commerce/orders/pipeline'
import {
  getOrderByStripeSession,
  logEvent,
  updateAbandonedCart,
  updateOrder,
} from '@/lib/commerce/db/repo'
import { getDriver, TABLES } from '@/lib/commerce/db'
import { eq } from '@/lib/commerce/db/driver'
import type { AbandonedCart, Address, Attribution, CartLine } from '@/lib/commerce/types'

export const runtime = 'nodejs'

/**
 * Commerce Stripe webhook.
 *
 * Deliberately separate from PropGuard's /api/webhooks/stripe and verified with
 * its own STRIPE_COMMERCE_WEBHOOK_SECRET, so a commerce event can never disturb
 * subscription billing (and vice versa).
 *
 * Idempotent: the order is keyed on the Stripe session id, so a replayed event
 * returns the existing order instead of creating a duplicate.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_COMMERCE_WEBHOOK_SECRET
  if (!secret || !config.stripeConfigured) {
    console.error('[commerce:webhook] rejected — Stripe webhook is not configured.')
    return NextResponse.json(
      { error: 'Commerce webhook is not configured (STRIPE_COMMERCE_WEBHOOK_SECRET).' },
      { status: 503 }
    )
  }

  const raw = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret)
  } catch (err) {
    console.error('[commerce:webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Ignore anything that is not ours — PropGuard subscriptions share the
        // same Stripe account.
        if (session.metadata?.commerce !== 'vesper') break
        await handleCheckoutCompleted(session)
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleRefund(charge)
        break
      }
      default:
        break
    }
  } catch (err) {
    // Return 500 so Stripe retries. Never swallow.
    console.error(`[commerce:webhook] handler failed for ${event.type}`, err)
    await logEvent({
      kind: 'webhook.error',
      level: 'error',
      message: `Stripe webhook ${event.type} failed: ${String(err)}`,
      data: { eventId: event.id },
    })
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const existing = await getOrderByStripeSession(session.id)
  if (existing) {
    await logEvent({
      kind: 'webhook.duplicate',
      message: `Duplicate checkout.session.completed for ${existing.order_number} — ignored.`,
      order_id: existing.id,
    })
    return
  }

  const cartId = session.metadata?.cart_id
  if (!cartId) throw new Error('Checkout session has no cart_id in metadata.')

  const cart = await getDriver().selectOne<AbandonedCart>(TABLES.abandonedCarts, {
    where: [eq('id', cartId)],
  })
  if (!cart) throw new Error(`Cart ${cartId} referenced by the checkout session no longer exists.`)

  const email =
    session.customer_details?.email ?? session.customer_email ?? cart.email ?? ''
  if (!email) throw new Error('Checkout session carried no customer email.')

  // Stripe's Checkout Session type exposes collected shipping under
  // collected_information on current API versions; fall back to the customer's
  // billing address when a shipping address was not collected.
  const collected = (session as unknown as {
    collected_information?: { shipping_details?: { name?: string | null; address?: Stripe.Address | null } }
  }).collected_information?.shipping_details
  const addr = collected?.address ?? session.customer_details?.address ?? null

  const shippingAddress: Address = {
    name: collected?.name ?? session.customer_details?.name ?? undefined,
    line1: addr?.line1 ?? undefined,
    line2: addr?.line2 ?? undefined,
    city: addr?.city ?? undefined,
    state: addr?.state ?? undefined,
    postal_code: addr?.postal_code ?? undefined,
    country: addr?.country ?? undefined,
  }

  const order = await createOrderFromCart({
    lines: cart.items as CartLine[],
    email,
    shippingAddress,
    attribution: cart.attribution as Attribution,
    currency: (session.currency ?? 'usd').toUpperCase(),
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
    chargedSubtotalCents: session.amount_subtotal ?? undefined,
    chargedShippingCents: session.total_details?.amount_shipping ?? undefined,
    chargedTotalCents: session.amount_total ?? undefined,
  })

  await updateAbandonedCart(cart.id, { recovered: true })

  // Fulfilment runs inline. If a supplier rejects the order it lands in
  // needs_attention with the reason attached — it is never reported as success.
  await processOrder(order.id)
}

async function handleRefund(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntentId) return

  const orders = await getDriver().select<{ id: string; refund_cents: number; order_number: string }>(
    TABLES.orders,
    { where: [eq('stripe_payment_intent_id', paymentIntentId)] }
  )
  const order = orders[0]
  if (!order) return

  await updateOrder(order.id, {
    refund_cents: charge.amount_refunded,
    status: charge.refunded ? 'refunded' : undefined,
  })
  await logEvent({
    kind: 'order.refunded',
    level: 'warn',
    message: `Refund of ${charge.amount_refunded} recorded against ${order.order_number}.`,
    order_id: order.id,
  })
}
