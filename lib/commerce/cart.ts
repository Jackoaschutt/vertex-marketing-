/**
 * Server-side cart pricing.
 *
 * The browser stores only {variantId, qty}. Every price, shipping charge and
 * total is derived here from the database, so a tampered localStorage cart
 * cannot change what a customer is charged.
 */

import { brand } from './brand'
import { config } from './config'
import { isSellable } from './research/scoring'
import { listImagesForProducts, listVariantsByIds, listProducts } from './db/repo'
import type { CartLine, PricedCart, PricedCartLine, Product } from './types'

export const MAX_CART_LINES = 20
export const MAX_LINE_QTY = 20

export function shippingFor(subtotalCents: number): number {
  if (subtotalCents <= 0) return 0
  return subtotalCents >= brand.shipping.freeThresholdCents ? 0 : brand.shipping.flatRateCents
}

export async function priceCart(lines: CartLine[]): Promise<PricedCart> {
  const currency = config.currency
  const empty: PricedCart = {
    lines: [],
    subtotalCents: 0,
    shippingCents: 0,
    totalCents: 0,
    currency,
    hasUnavailable: false,
  }
  if (lines.length === 0) return empty

  // Collapse duplicate variant ids and clamp quantities before any lookup.
  const wanted = new Map<string, number>()
  for (const line of lines.slice(0, MAX_CART_LINES)) {
    const qty = Math.max(1, Math.min(MAX_LINE_QTY, Math.round(line.qty)))
    wanted.set(line.variantId, Math.min(MAX_LINE_QTY, (wanted.get(line.variantId) ?? 0) + qty))
  }

  const variants = await listVariantsByIds([...wanted.keys()])
  const productIds = [...new Set(variants.map((v) => v.product_id))]
  const [allProducts, images] = await Promise.all([
    listProducts({}),
    listImagesForProducts(productIds),
  ])
  const productById = new Map<string, Product>(allProducts.map((p) => [p.id, p]))

  const priced: PricedCartLine[] = []
  for (const [variantId, qty] of wanted) {
    const variant = variants.find((v) => v.id === variantId)
    if (!variant) {
      priced.push({
        variantId,
        productId: '',
        slug: '',
        title: 'Unavailable item',
        variantTitle: '',
        image: null,
        qty,
        unitPriceCents: 0,
        lineTotalCents: 0,
        available: false,
        reason: 'This item is no longer available.',
      })
      continue
    }
    const product = productById.get(variant.product_id)
    const sellable = !!product && product.published && isSellable(product.status)
    const inStock = variant.stock === null || variant.stock >= qty

    const unit = variant.price_cents
    const available = sellable && inStock
    priced.push({
      variantId,
      productId: variant.product_id,
      slug: product?.slug ?? '',
      title: product?.name ?? 'Unknown product',
      variantTitle: variant.title,
      image: images.find((i) => i.product_id === variant.product_id)?.url ?? null,
      qty,
      unitPriceCents: unit,
      lineTotalCents: unit * qty,
      available,
      reason: !sellable
        ? 'This product is no longer on sale.'
        : !inStock
          ? `Only ${variant.stock} left in stock.`
          : undefined,
    })
  }

  const sellableLines = priced.filter((l) => l.available)
  const subtotalCents = sellableLines.reduce((sum, l) => sum + l.lineTotalCents, 0)
  const shippingCents = shippingFor(subtotalCents)

  return {
    lines: priced,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency,
    hasUnavailable: priced.some((l) => !l.available),
  }
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0)
}
