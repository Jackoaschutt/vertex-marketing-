import { NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { brand, absoluteUrl, storeUrl } from '@/lib/commerce/brand'
import { config } from '@/lib/commerce/config'
import { priceCart } from '@/lib/commerce/cart'
import { recordAbandonedCart } from '@/lib/commerce/db/repo'
import { deserializeAttribution, ATTRIBUTION_COOKIE } from '@/lib/commerce/analytics/attribution'
import { clientKey, fail, handleError, ok, rateLimit, readJson, tooManyRequests } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'

export const runtime = 'nodejs'

const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU', 'IE', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'DK', 'NZ'] as const

/**
 * POST /api/commerce/checkout
 *
 * Re-prices the cart server-side and opens a Stripe Checkout Session. The
 * client's prices are never trusted — only {variantId, qty} is read from the
 * request body.
 *
 * The cart is persisted as an abandoned-cart row first; its id travels in the
 * session metadata. That gives the webhook a reliable way to rebuild the order
 * (Stripe metadata values are length-limited, so the cart itself cannot ride
 * along) and gives abandoned-cart recovery for free.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(clientKey(request, 'checkout'), 10, 60_000)
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds)

    const body = await readJson(request)
    const v = new Validator(body)
    const lines = v.cartLines('lines')
    const email = v.email('email', false)
    v.done()

    if (lines.length === 0) return fail(400, 'Your cart is empty.')

    const priced = await priceCart(lines)
    const sellable = priced.lines.filter((l) => l.available)
    if (sellable.length === 0) {
      return fail(409, 'None of the items in your cart are available.', { cart: priced })
    }

    if (!config.stripeConfigured) {
      // Do not fake a checkout. Say exactly what is missing.
      return fail(
        503,
        'Checkout is not available: Stripe is not configured on this deployment.',
        {
          requires: ['STRIPE_SECRET_KEY', 'STRIPE_COMMERCE_WEBHOOK_SECRET'],
          cart: priced,
        }
      )
    }

    const attribution = deserializeAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value)

    const cart = await recordAbandonedCart({
      email: email || null,
      items: sellable.map((l) => ({ variantId: l.variantId, qty: l.qty })),
      value_cents: priced.totalCents,
      recovered: false,
      attribution,
    })

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: sellable.map((line) => ({
        quantity: line.qty,
        price_data: {
          currency: priced.currency.toLowerCase(),
          unit_amount: line.unitPriceCents,
          product_data: {
            name: `${line.title}${line.variantTitle && line.variantTitle !== 'Default' ? ` — ${line.variantTitle}` : ''}`,
            images: line.image ? [absoluteUrl(line.image)] : undefined,
          },
        },
      })),
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: priced.shippingCents, currency: priced.currency.toLowerCase() },
            display_name:
              priced.shippingCents === 0 ? 'Free tracked delivery' : 'Tracked delivery',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 14 },
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: [...ALLOWED_COUNTRIES] },
      customer_email: email || undefined,
      // Cart id, not the cart itself — Stripe metadata values are capped at 500
      // characters and a 20-line cart would overflow.
      metadata: {
        commerce: 'vesper',
        cart_id: cart.id,
        attribution_source: attribution.source ?? 'direct',
      },
      success_url: absoluteUrl(`${storeUrl('/order/confirmed')}?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: absoluteUrl(storeUrl('/cart')),
    })

    if (!session.url) return fail(502, 'Stripe did not return a checkout URL.')

    return ok({ url: session.url, sessionId: session.id, brand: brand.name })
  } catch (err) {
    return handleError(err, 'checkout')
  }
}
