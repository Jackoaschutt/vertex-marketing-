import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/webhooks/stripe — handle Stripe webhook events (raw body, no JSON.parse)
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription') {
        await supabase
          .from('traders')
          .update({
            subscription_status: 'active',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq('stripe_customer_id', session.customer as string)
      }
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const status =
        sub.status === 'active'
          ? 'active'
          : sub.status === 'past_due'
          ? 'past_due'
          : sub.status === 'canceled'
          ? 'canceled'
          : 'trialing'
      await supabase
        .from('traders')
        .update({ subscription_status: status })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('traders')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice
      await supabase
        .from('traders')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', inv.customer as string)
      break
    }
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as Stripe.Invoice
      await supabase
        .from('traders')
        .update({ subscription_status: 'active' })
        .eq('stripe_customer_id', inv.customer as string)
      break
    }
  }

  return NextResponse.json({ received: true })
}
