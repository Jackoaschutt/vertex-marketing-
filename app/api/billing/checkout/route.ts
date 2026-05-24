import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'

// POST /api/billing/checkout — create Stripe checkout session
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trader } = await supabase
    .from('traders')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  let customerId = trader?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: trader?.email ?? user.email! })
    customerId = customer.id
    await supabase.from('traders').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/paywall`,
  })

  return NextResponse.json({ url: session.url })
}
