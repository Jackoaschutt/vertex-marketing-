/**
 * Supplier abstraction.
 *
 * Nothing above this file may import a supplier-specific module. Adding a new
 * supplier is writing one adapter and registering it; swapping the supplier for
 * a live product is a database update, not a code change.
 */

export interface SupplierProduct {
  supplierSku: string
  title: string
  description: string
  imageUrls: string[]
  costCents: number
  shippingCents: number
  currency: string
  leadDays: number
  variants: { supplierSku: string; title: string; costCents: number; stock: number | null }[]
  sourceUrl: string | null
  /** Present and true only on MOCK adapters. Never set by a real integration. */
  __mock?: true
}

export interface InventoryLevel {
  supplierSku: string
  available: number | null // null = supplier does not report stock
  checkedAt: string
  __mock?: true
}

export interface SupplierPrice {
  supplierSku: string
  costCents: number
  shippingCents: number
  currency: string
  checkedAt: string
  __mock?: true
}

export interface SupplierOrderLine {
  supplierSku: string
  quantity: number
}

export interface CreateSupplierOrderRequest {
  /** Our order number — passed through so the supplier can be reconciled. */
  reference: string
  lines: SupplierOrderLine[]
  shippingAddress: {
    name: string
    line1: string
    line2?: string
    city: string
    state?: string
    postalCode: string
    country: string
    phone?: string
    email?: string
  }
  note?: string
}

export interface SupplierOrderRef {
  supplierRef: string
  status: SupplierFulfillmentStatus
  costCents: number
  raw?: unknown
  __mock?: true
}

export type SupplierFulfillmentStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed'

export interface SupplierOrderStatus {
  supplierRef: string
  status: SupplierFulfillmentStatus
  message?: string
  __mock?: true
}

export interface TrackingInfo {
  supplierRef: string
  trackingNumber: string
  carrier: string | null
  trackingUrl: string | null
  shippedAt: string | null
  deliveredAt: string | null
  __mock?: true
}

export interface SupplierAdapter {
  readonly id: string
  /** REAL = talks to a live API. MOCK = simulated, never a real fulfilment. */
  readonly status: 'REAL' | 'MOCK'
  /** Human-readable note surfaced in /ops/suppliers. */
  readonly note: string

  getProducts(query?: string): Promise<SupplierProduct[]>
  getProduct(supplierSku: string): Promise<SupplierProduct | null>
  getInventory(supplierSku: string): Promise<InventoryLevel>
  getPrice(supplierSku: string): Promise<SupplierPrice>
  createOrder(req: CreateSupplierOrderRequest): Promise<SupplierOrderRef>
  getOrderStatus(supplierRef: string): Promise<SupplierOrderStatus>
  getTracking(supplierRef: string): Promise<TrackingInfo | null>
}

export class SupplierError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'SupplierError'
  }
}

/**
 * Thrown when an adapter is selected but its credentials are absent. It is
 * never caught and converted into a fake success — the order is marked
 * needs_attention and the operator is told exactly what to set.
 */
export class SupplierNotConfiguredError extends Error {
  constructor(readonly adapter: string, readonly requires: string[]) {
    super(
      `Supplier adapter "${adapter}" is not configured. Set: ${requires.join(', ')}.`
    )
    this.name = 'SupplierNotConfiguredError'
  }
}
