import { NextRequest } from 'next/server'
import { priceCart } from '@/lib/commerce/cart'
import { clientKey, handleError, ok, rateLimit, readJson, tooManyRequests } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/cart/validate
 *
 * Public. Re-prices a client cart from the database and reports which lines are
 * unavailable and why. The browser sends only {variantId, qty}.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(clientKey(request, 'cart'), 60, 60_000)
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds)

    const body = await readJson(request)
    const v = new Validator(body)
    const lines = v.cartLines('lines')
    v.done()

    return ok(await priceCart(lines))
  } catch (err) {
    return handleError(err, 'cart/validate')
  }
}
