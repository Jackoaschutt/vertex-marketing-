/**
 * Order pipeline.
 *
 *   paid → validate → group by supplier → submit to each supplier
 *        → record fulfilment → poll tracking → notify customer → delivered
 *
 * Failure is never swallowed. Any supplier rejection, missing configuration or
 * unexpected error moves the order to `needs_attention` with the reason
 * attached, writes an error row to ds_events, and leaves the order retryable
 * from /ops/orders. Retries are idempotent: a supplier group that already has a
 * fulfilment is never re-submitted.
 */

import { sendTemplate } from '../email'
import { adapterFor } from '../suppliers/registry'
import { SupplierError, SupplierNotConfiguredError } from '../suppliers/types'
import {
  createFulfillment,
  getOrder,
  getSupplier,
  listFulfillments,
  listOrderItems,
  logEvent,
  supplierLinkForVariant,
  updateFulfillment,
  updateOrder,
} from '../db/repo'
import type { Fulfillment, Order, OrderItem, Supplier } from '../types'

export interface PipelineResult {
  orderId: string
  status: Order['status']
  submitted: number
  skipped: number
  failures: { supplierId: string | null; message: string }[]
}

export function generateOrderNumber(seed = Date.now()): string {
  // Human-readable, sortable, and short enough for supplier reference fields.
  const base36 = seed.toString(36).toUpperCase().slice(-6)
  const rand = Math.floor(Math.random() * 36 ** 2)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0')
  return `VSP-${base36}${rand}`
}

async function fail(order: Order, reason: string, data: Record<string, unknown> = {}): Promise<void> {
  await updateOrder(order.id, { status: 'needs_attention', attention_reason: reason })
  await logEvent({
    kind: 'order.needs_attention',
    level: 'error',
    message: reason,
    order_id: order.id,
    data,
  })
  // Admin notification: the console is the transport of record until an email
  // transport is configured. This is intentionally loud — a silent failure here
  // means a paid customer never receives their goods.
  console.error(`[commerce:order] ${order.order_number} needs attention — ${reason}`)
}

/**
 * Groups items by the supplier that will actually fulfil them, resolving the
 * supplier SKU from the variant→supplier mapping.
 */
async function groupBySupplier(items: OrderItem[]): Promise<
  Map<string | null, { items: OrderItem[]; skus: Map<string, string> }>
> {
  type Group = { items: OrderItem[]; skus: Map<string, string> }
  const groups = new Map<string | null, Group>()
  for (const item of items) {
    const link = item.variant_id ? await supplierLinkForVariant(item.variant_id) : null
    const supplierId = link?.supplier_id ?? item.supplier_id ?? null
    const group: Group = groups.get(supplierId) ?? { items: [], skus: new Map<string, string>() }
    group.items.push(item)
    // Fall back to our own SKU when no supplier mapping exists — the supplier
    // will reject it, which surfaces the missing mapping instead of hiding it.
    group.skus.set(item.id, link?.supplier_sku ?? item.sku)
    groups.set(supplierId, group)
  }
  return groups
}

export async function processOrder(orderId: string): Promise<PipelineResult> {
  const order = await getOrder(orderId)
  if (!order) throw new Error(`Order ${orderId} not found.`)

  const result: PipelineResult = {
    orderId,
    status: order.status,
    submitted: 0,
    skipped: 0,
    failures: [],
  }

  if (order.status === 'cancelled' || order.status === 'refunded') {
    result.skipped += 1
    return result
  }

  const items = await listOrderItems(orderId)
  if (items.length === 0) {
    await fail(order, 'Order has no line items — nothing to fulfil.')
    result.status = 'needs_attention'
    return result
  }

  // --- validate ------------------------------------------------------------
  const address = order.shipping_address ?? {}
  const missing = (['line1', 'city', 'postal_code', 'country'] as const).filter(
    (k) => !String(address[k] ?? '').trim()
  )
  if (missing.length > 0) {
    await fail(order, `Shipping address is incomplete: missing ${missing.join(', ')}.`, { missing })
    result.status = 'needs_attention'
    return result
  }

  if (order.status === 'received') {
    await updateOrder(orderId, { status: 'validated', attention_reason: null })
    await logEvent({ kind: 'order.validated', message: `Order ${order.order_number} validated.`, order_id: orderId })
  }

  // --- route + submit ------------------------------------------------------
  const existing = await listFulfillments(orderId)
  const groups = await groupBySupplier(items)
  await updateOrder(orderId, { status: 'routed' })

  for (const [supplierId, group] of groups) {
    const already = existing.find(
      (f) => f.supplier_id === supplierId && f.status !== 'failed'
    )
    if (already) {
      result.skipped += 1
      continue
    }

    let supplier: Supplier | null = null
    try {
      supplier = supplierId ? await getSupplier(supplierId) : null
      const adapter = adapterFor(supplier)

      const ref = await adapter.createOrder({
        reference: order.order_number,
        lines: group.items.map((i) => ({
          supplierSku: group.skus.get(i.id) ?? i.sku,
          quantity: i.quantity,
        })),
        shippingAddress: {
          name: String(address.name ?? order.email),
          line1: String(address.line1 ?? ''),
          line2: address.line2 ? String(address.line2) : undefined,
          city: String(address.city ?? ''),
          state: address.state ? String(address.state) : undefined,
          postalCode: String(address.postal_code ?? ''),
          country: String(address.country ?? ''),
          email: order.email,
        },
        note: `Order ${order.order_number}`,
      })

      if (ref.status === 'failed') {
        throw new SupplierError(
          `Supplier rejected order ${order.order_number} (ref ${ref.supplierRef}).`
        )
      }

      // Reuse a previously failed fulfilment row so retries do not accumulate.
      const previousFailure = existing.find((f) => f.supplier_id === supplierId)
      const payload = {
        order_id: orderId,
        supplier_id: supplierId,
        supplier_ref: ref.supplierRef,
        status: 'submitted' as const,
        cost_cents: ref.costCents,
        error_message: null,
        submitted_at: new Date().toISOString(),
      }
      if (previousFailure) await updateFulfillment(previousFailure.id, payload)
      else await createFulfillment(payload)

      result.submitted += 1
      await logEvent({
        kind: 'fulfillment.submitted',
        message: `Submitted ${group.items.length} line(s) to ${supplier?.name ?? 'default supplier'} (${adapter.id}).`,
        order_id: orderId,
        data: { supplierRef: ref.supplierRef, adapter: adapter.id, mock: adapter.status === 'MOCK' },
      })
    } catch (err) {
      const message =
        err instanceof SupplierNotConfiguredError
          ? err.message
          : err instanceof SupplierError
            ? err.message
            : `Unexpected error submitting to supplier: ${String(err)}`

      result.failures.push({ supplierId, message })

      const previousFailure = existing.find((f) => f.supplier_id === supplierId)
      const payload = {
        order_id: orderId,
        supplier_id: supplierId,
        supplier_ref: null,
        status: 'failed' as const,
        error_message: message,
      }
      if (previousFailure) await updateFulfillment(previousFailure.id, payload)
      else await createFulfillment(payload)
    }
  }

  if (result.failures.length > 0) {
    await fail(
      order,
      result.failures.map((f) => f.message).join(' | '),
      { failures: result.failures }
    )
    result.status = 'needs_attention'
    return result
  }

  const fresh = await getOrder(orderId)
  if (fresh && fresh.status !== 'needs_attention') {
    await updateOrder(orderId, { status: 'submitted', attention_reason: null })
    result.status = 'submitted'
  }

  // Confirmation email is deduped by (order_id, template), so a retry after a
  // partial failure will not send it twice.
  await sendTemplate('order_confirmation', order.email, { order, items })

  return result
}

export interface TrackingSyncResult {
  orderId: string
  updated: number
  shipped: number
  delivered: number
}

/** Polls each open fulfilment for status and tracking, and notifies on change. */
export async function syncOrderTracking(orderId: string): Promise<TrackingSyncResult> {
  const out: TrackingSyncResult = { orderId, updated: 0, shipped: 0, delivered: 0 }
  const order = await getOrder(orderId)
  if (!order) return out

  const fulfillments = await listFulfillments(orderId)
  const items = await listOrderItems(orderId)

  for (const f of fulfillments) {
    if (!f.supplier_ref) continue
    if (f.status === 'delivered' || f.status === 'cancelled') continue

    try {
      const supplier = f.supplier_id ? await getSupplier(f.supplier_id) : null
      const adapter = adapterFor(supplier)
      const status = await adapter.getOrderStatus(f.supplier_ref)
      const tracking = await adapter.getTracking(f.supplier_ref)

      const patch: Partial<Fulfillment> = {}
      if (status.status !== f.status) patch.status = status.status
      if (tracking) {
        if (tracking.trackingNumber !== f.tracking_number) {
          patch.tracking_number = tracking.trackingNumber
          patch.tracking_url = tracking.trackingUrl
          patch.carrier = tracking.carrier
        }
        if (tracking.shippedAt && !f.shipped_at) patch.shipped_at = tracking.shippedAt
        if (tracking.deliveredAt && !f.delivered_at) patch.delivered_at = tracking.deliveredAt
      }
      if (Object.keys(patch).length === 0) continue

      const updated = await updateFulfillment(f.id, patch)
      out.updated += 1

      if (updated.status === 'shipped' && f.status !== 'shipped') {
        out.shipped += 1
        await updateOrder(orderId, { status: 'fulfilled', fulfilled_at: new Date().toISOString() })
        await sendTemplate('order_shipped', order.email, { order, items, fulfillment: updated })
      }
      // f.status cannot already be 'delivered' — those fulfilments are skipped
      // at the top of the loop — so any transition to delivered is new.
      if (updated.status === 'delivered') {
        out.delivered += 1
        await updateOrder(orderId, { status: 'delivered', delivered_at: new Date().toISOString() })
        await sendTemplate('order_delivered', order.email, { order, items, fulfillment: updated })
      }
    } catch (err) {
      // A tracking poll failure is not an order failure — log it and move on so
      // one bad supplier cannot stall the whole sweep.
      await logEvent({
        kind: 'fulfillment.tracking_error',
        level: 'warn',
        message: `Tracking poll failed for ${order.order_number}: ${String(err)}`,
        order_id: orderId,
      })
    }
  }

  return out
}

/** Applies an inbound supplier webhook to the matching fulfilment. */
export async function applySupplierUpdate(
  fulfillment: Fulfillment,
  update: {
    status?: Fulfillment['status']
    trackingNumber?: string
    trackingUrl?: string
    carrier?: string
  }
): Promise<void> {
  const patch: Partial<Fulfillment> = {}
  if (update.status && update.status !== fulfillment.status) patch.status = update.status
  if (update.trackingNumber) {
    patch.tracking_number = update.trackingNumber
    patch.tracking_url = update.trackingUrl ?? null
    patch.carrier = update.carrier ?? null
  }
  if (update.status === 'shipped') patch.shipped_at = new Date().toISOString()
  if (update.status === 'delivered') patch.delivered_at = new Date().toISOString()
  if (Object.keys(patch).length === 0) return

  const updated = await updateFulfillment(fulfillment.id, patch)
  const order = await getOrder(fulfillment.order_id)
  if (!order) return
  const items = await listOrderItems(order.id)

  if (updated.status === 'shipped') {
    await updateOrder(order.id, { status: 'fulfilled', fulfilled_at: new Date().toISOString() })
    await sendTemplate('order_shipped', order.email, { order, items, fulfillment: updated })
  }
  if (updated.status === 'delivered') {
    await updateOrder(order.id, { status: 'delivered', delivered_at: new Date().toISOString() })
    await sendTemplate('order_delivered', order.email, { order, items, fulfillment: updated })
  }
  if (updated.status === 'failed') {
    await fail(order, `Supplier reported a failure after submission (fulfilment ${updated.id}).`)
  }
}
