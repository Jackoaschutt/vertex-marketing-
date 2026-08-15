import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto'
import { findFulfillmentByRef, logEvent } from '@/lib/commerce/db/repo'
import { applySupplierUpdate } from '@/lib/commerce/orders/pipeline'
import type { FulfillmentStatus } from '@/lib/commerce/types'

export const runtime = 'nodejs'

const STATUSES: FulfillmentStatus[] = [
  'pending',
  'submitted',
  'processing',
  'shipped',
  'delivered',
  'failed',
  'cancelled',
]

/**
 * POST /api/commerce/webhooks/supplier
 *
 * Generic supplier callback. The body is verified with an HMAC-SHA256
 * signature over the raw payload using SUPPLIER_WEBHOOK_SECRET, sent in the
 * `x-supplier-signature` header (hex).
 *
 * Expected JSON:
 *   { "reference": "<supplier order ref>", "status": "shipped",
 *     "trackingNumber": "...", "carrier": "...", "trackingUrl": "..." }
 *
 * Without a configured secret the endpoint rejects everything — it does not
 * fall back to accepting unsigned input.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SUPPLIER_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Supplier webhooks are not configured (SUPPLIER_WEBHOOK_SECRET).' },
      { status: 503 }
    )
  }

  const raw = await request.text()
  const provided = request.headers.get('x-supplier-signature') ?? ''
  const expected = createHmac('sha256', secret).update(raw).digest('hex')

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !nodeTimingSafeEqual(a, b)) {
    await logEvent({
      kind: 'webhook.supplier.rejected',
      level: 'warn',
      message: 'Supplier webhook rejected: signature mismatch.',
    })
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  const reference = typeof payload.reference === 'string' ? payload.reference : ''
  if (!reference) return NextResponse.json({ error: 'reference is required.' }, { status: 400 })

  const status = typeof payload.status === 'string' ? payload.status : ''
  if (status && !STATUSES.includes(status as FulfillmentStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(', ')}.` },
      { status: 400 }
    )
  }

  const fulfillment = await findFulfillmentByRef(reference)
  if (!fulfillment) {
    // 202: signature was valid, we simply do not know this reference. Returning
    // 404 would make well-behaved suppliers retry forever.
    await logEvent({
      kind: 'webhook.supplier.unknown_ref',
      level: 'warn',
      message: `Supplier webhook referenced unknown fulfilment "${reference}".`,
    })
    return NextResponse.json({ received: true, matched: false }, { status: 202 })
  }

  try {
    await applySupplierUpdate(fulfillment, {
      status: status ? (status as FulfillmentStatus) : undefined,
      trackingNumber: typeof payload.trackingNumber === 'string' ? payload.trackingNumber : undefined,
      trackingUrl: typeof payload.trackingUrl === 'string' ? payload.trackingUrl : undefined,
      carrier: typeof payload.carrier === 'string' ? payload.carrier : undefined,
    })
  } catch (err) {
    console.error('[commerce:webhook:supplier] handler failed', err)
    await logEvent({
      kind: 'webhook.supplier.error',
      level: 'error',
      message: `Supplier webhook handler failed for ${reference}: ${String(err)}`,
      order_id: fulfillment.order_id,
    })
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 })
  }

  return NextResponse.json({ received: true, matched: true })
}
