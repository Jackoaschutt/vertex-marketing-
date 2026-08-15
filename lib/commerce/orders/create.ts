/**
 * Order creation from a completed checkout.
 *
 * Idempotent on the Stripe session id: replaying the webhook returns the
 * existing order rather than creating a duplicate or charging anything twice.
 */

import { paymentFee } from '../money'
import { priceCart } from '../cart'
import {
  createOrder,
  createOrderItems,
  findCustomerByEmail,
  getOrderByStripeSession,
  listVariantsByIds,
  logEvent,
  supplierLinkForVariant,
  updateProduct,
  getProductRow,
  upsertCustomer,
} from '../db/repo'
import { generateOrderNumber } from './pipeline'
import type { Address, Attribution, CartLine, Order } from '../types'

export interface CreateOrderInput {
  lines: CartLine[]
  email: string
  shippingAddress: Address
  attribution?: Attribution
  currency?: string
  stripeSessionId?: string | null
  stripePaymentIntentId?: string | null
  /** Totals as actually charged, when known. Falls back to re-priced values. */
  chargedSubtotalCents?: number
  chargedShippingCents?: number
  chargedTotalCents?: number
  feePercent?: number
  feeFixedCents?: number
}

export async function createOrderFromCart(input: CreateOrderInput): Promise<Order> {
  if (input.stripeSessionId) {
    const existing = await getOrderByStripeSession(input.stripeSessionId)
    if (existing) return existing
  }

  const priced = await priceCart(input.lines)
  const sellable = priced.lines.filter((l) => l.available)
  if (sellable.length === 0) {
    throw new Error('Cannot create an order with no available line items.')
  }

  const variants = await listVariantsByIds(sellable.map((l) => l.variantId))

  const subtotal = input.chargedSubtotalCents ?? priced.subtotalCents
  const shipping = input.chargedShippingCents ?? priced.shippingCents
  const total = input.chargedTotalCents ?? subtotal + shipping
  const cogs = sellable.reduce((sum, line) => {
    const v = variants.find((x) => x.id === line.variantId)
    return sum + (v?.cost_cents ?? 0) * line.qty
  }, 0)

  const customer = await findCustomerByEmail(input.email)

  const order = await createOrder({
    order_number: generateOrderNumber(),
    customer_id: customer?.id ?? null,
    email: input.email.toLowerCase(),
    currency: input.currency ?? priced.currency,
    subtotal_cents: subtotal,
    shipping_cents: shipping,
    tax_cents: 0,
    discount_cents: 0,
    total_cents: total,
    payment_fee_cents: paymentFee(total, input.feePercent, input.feeFixedCents),
    cogs_cents: cogs,
    refund_cents: 0,
    status: 'received',
    attention_reason: null,
    shipping_address: input.shippingAddress,
    attribution: input.attribution ?? {},
    stripe_session_id: input.stripeSessionId ?? null,
    stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    placed_at: new Date().toISOString(),
  })

  const itemRows = []
  for (const line of sellable) {
    const variant = variants.find((v) => v.id === line.variantId)
    const link = await supplierLinkForVariant(line.variantId)
    const product = await getProductRow(line.productId)
    itemRows.push({
      order_id: order.id,
      product_id: line.productId || null,
      variant_id: line.variantId,
      supplier_id: link?.supplier_id ?? product?.supplier_id ?? null,
      sku: variant?.sku ?? line.variantId,
      title: `${line.title}${variant && variant.title !== 'Default' ? ` — ${variant.title}` : ''}`,
      quantity: line.qty,
      unit_price_cents: line.unitPriceCents,
      unit_cost_cents: variant?.cost_cents ?? 0,
    })
  }
  await createOrderItems(itemRows)

  // Customer rollup
  await upsertCustomer(input.email, {
    name: input.shippingAddress.name ?? customer?.name ?? null,
    orders_count: (customer?.orders_count ?? 0) + 1,
    spend_cents: (customer?.spend_cents ?? 0) + total,
    first_order_at: customer?.first_order_at ?? order.placed_at,
    last_order_at: order.placed_at,
  })

  // Denormalised product performance, so dashboards stay fast.
  const byProduct = new Map<string, { revenue: number; orders: number }>()
  for (const row of itemRows) {
    if (!row.product_id) continue
    const entry = byProduct.get(row.product_id) ?? { revenue: 0, orders: 0 }
    entry.revenue += row.unit_price_cents * row.quantity
    entry.orders += 1
    byProduct.set(row.product_id, entry)
  }
  for (const [productId, agg] of byProduct) {
    const product = await getProductRow(productId)
    if (!product) continue
    await updateProduct(productId, {
      revenue_cents: product.revenue_cents + agg.revenue,
      orders_count: product.orders_count + agg.orders,
    })
  }

  await logEvent({
    kind: 'order.created',
    message: `Order ${order.order_number} created for ${input.email}.`,
    order_id: order.id,
    data: { total, source: input.attribution?.source ?? 'direct' },
  })

  return order
}
