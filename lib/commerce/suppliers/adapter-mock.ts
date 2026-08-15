/**
 * MOCK SUPPLIER ADAPTER.
 *
 * This adapter does not talk to any supplier. It simulates a catalogue and a
 * fulfilment lifecycle so the order pipeline, tracking emails and dashboards
 * can be exercised end to end without a supplier account.
 *
 * Every response it returns carries `__mock: true`. The ops UI renders that as
 * a MOCK badge. It must never be used to fulfil a real customer order.
 */

import type {
  CreateSupplierOrderRequest,
  InventoryLevel,
  SupplierAdapter,
  SupplierOrderRef,
  SupplierOrderStatus,
  SupplierPrice,
  SupplierProduct,
  TrackingInfo,
} from './types'

interface MockOrderRecord {
  ref: string
  createdAt: number
  costCents: number
  lines: { supplierSku: string; quantity: number }[]
  failed: boolean
}

// Process-local. Resets on restart, like the demo data driver.
const orders = new Map<string, MockOrderRecord>()

/** Deterministic pseudo-random from a string, so behaviour is reproducible. */
function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const CATALOGUE: SupplierProduct[] = [
  {
    supplierSku: 'MOCK-LAMP-01',
    title: 'Dimmable bedside lamp, warm LED',
    description: 'Touch-dimmable bedside lamp with a 2200K–3000K warm LED and USB-C power.',
    imageUrls: [],
    costCents: 1180,
    shippingCents: 420,
    currency: 'USD',
    leadDays: 2,
    variants: [
      { supplierSku: 'MOCK-LAMP-01-CHR', title: 'Charcoal', costCents: 1180, stock: 420 },
      { supplierSku: 'MOCK-LAMP-01-SND', title: 'Sand', costCents: 1180, stock: 58 },
    ],
    sourceUrl: null,
    __mock: true,
  },
  {
    supplierSku: 'MOCK-SOUND-01',
    title: 'White noise machine, 12 tones',
    description: 'Fan-based and digital white noise machine with a sleep timer.',
    imageUrls: [],
    costCents: 1420,
    shippingCents: 480,
    currency: 'USD',
    leadDays: 3,
    variants: [{ supplierSku: 'MOCK-SOUND-01', title: 'Default', costCents: 1420, stock: 310 }],
    sourceUrl: null,
    __mock: true,
  },
  {
    supplierSku: 'MOCK-MASK-01',
    title: 'Weighted contoured sleep mask',
    description: 'Contoured sleep mask with a removable weighted insert and adjustable strap.',
    imageUrls: [],
    costCents: 640,
    shippingCents: 260,
    currency: 'USD',
    leadDays: 2,
    variants: [{ supplierSku: 'MOCK-MASK-01', title: 'Default', costCents: 640, stock: 900 }],
    sourceUrl: null,
    __mock: true,
  },
]

export class MockSupplierAdapter implements SupplierAdapter {
  readonly id = 'mock'
  readonly status = 'MOCK' as const
  readonly note =
    'Simulated supplier. Orders are not sent anywhere and tracking numbers are fabricated. Replace before taking real orders.'

  async getProducts(query?: string): Promise<SupplierProduct[]> {
    if (!query) return CATALOGUE
    const q = query.toLowerCase()
    return CATALOGUE.filter(
      (p) => p.title.toLowerCase().includes(q) || p.supplierSku.toLowerCase().includes(q)
    )
  }

  async getProduct(supplierSku: string): Promise<SupplierProduct | null> {
    return (
      CATALOGUE.find(
        (p) => p.supplierSku === supplierSku || p.variants.some((v) => v.supplierSku === supplierSku)
      ) ?? null
    )
  }

  async getInventory(supplierSku: string): Promise<InventoryLevel> {
    const product = await this.getProduct(supplierSku)
    const variant = product?.variants.find((v) => v.supplierSku === supplierSku)
    // Deterministic drift so the inventory-drift automation has something real
    // to detect between runs.
    const base = variant?.stock ?? product?.variants[0]?.stock ?? 100
    const drift = (hash(supplierSku + new Date().toISOString().slice(0, 10)) % 21) - 10
    return {
      supplierSku,
      available: Math.max(0, base + drift),
      checkedAt: new Date().toISOString(),
      __mock: true,
    }
  }

  async getPrice(supplierSku: string): Promise<SupplierPrice> {
    const product = await this.getProduct(supplierSku)
    const variant = product?.variants.find((v) => v.supplierSku === supplierSku)
    const base = variant?.costCents ?? product?.costCents ?? 1000
    const drift = (hash(`price:${supplierSku}`) % 7) - 3
    return {
      supplierSku,
      costCents: Math.max(1, base + drift * 10),
      shippingCents: product?.shippingCents ?? 300,
      currency: 'USD',
      checkedAt: new Date().toISOString(),
      __mock: true,
    }
  }

  async createOrder(req: CreateSupplierOrderRequest): Promise<SupplierOrderRef> {
    // Simulate a realistic validation failure so the needs_attention path is
    // reachable in demo mode rather than only in theory.
    const failed = req.shippingAddress.line1.length > 35
    const ref = `MOCK-${req.reference}-${hash(req.reference).toString(36).slice(0, 6).toUpperCase()}`

    let costCents = 0
    for (const line of req.lines) {
      const price = await this.getPrice(line.supplierSku)
      costCents += (price.costCents + price.shippingCents) * line.quantity
    }

    orders.set(ref, {
      ref,
      createdAt: Date.now(),
      costCents,
      lines: req.lines,
      failed,
    })

    if (failed) {
      return { supplierRef: ref, status: 'failed', costCents, __mock: true }
    }
    return { supplierRef: ref, status: 'processing', costCents, __mock: true }
  }

  async getOrderStatus(supplierRef: string): Promise<SupplierOrderStatus> {
    const rec = orders.get(supplierRef)
    if (!rec) {
      return { supplierRef, status: 'failed', message: 'Unknown reference (mock store was reset).', __mock: true }
    }
    if (rec.failed) {
      return {
        supplierRef,
        status: 'failed',
        message: 'Address line 1 exceeded 35 characters and was rejected at intake.',
        __mock: true,
      }
    }
    const ageMinutes = (Date.now() - rec.createdAt) / 60_000
    // Compressed lifecycle so the pipeline can be watched in a single session.
    if (ageMinutes > 10) return { supplierRef, status: 'delivered', __mock: true }
    if (ageMinutes > 2) return { supplierRef, status: 'shipped', __mock: true }
    return { supplierRef, status: 'processing', __mock: true }
  }

  async getTracking(supplierRef: string): Promise<TrackingInfo | null> {
    const status = await this.getOrderStatus(supplierRef)
    if (status.status !== 'shipped' && status.status !== 'delivered') return null
    const number = `MK${(hash(supplierRef) % 1_000_000).toString().padStart(6, '0')}US`
    return {
      supplierRef,
      trackingNumber: number,
      carrier: 'Mock Post',
      trackingUrl: `https://example.com/track/${number}`,
      shippedAt: new Date(orders.get(supplierRef)!.createdAt + 120_000).toISOString(),
      deliveredAt: status.status === 'delivered' ? new Date().toISOString() : null,
      __mock: true,
    }
  }
}
