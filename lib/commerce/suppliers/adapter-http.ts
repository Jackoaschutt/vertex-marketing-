/**
 * GENERIC HTTP SUPPLIER ADAPTER — REAL.
 *
 * Most dropshipping suppliers expose a plain JSON API that differs only in URL
 * shape and field names. Rather than forking a module per supplier, this
 * adapter is driven entirely by configuration stored on the supplier row
 * (ds_suppliers.config) plus one secret from the environment.
 *
 * It makes real HTTP requests. If the supplier is not configured it throws
 * SupplierNotConfiguredError rather than pretending to succeed.
 *
 * Example ds_suppliers.config:
 * {
 *   "baseUrl": "https://api.example-supplier.com/v1",
 *   "authHeader": "Authorization",
 *   "authScheme": "Bearer",
 *   "tokenEnv": "EXAMPLE_SUPPLIER_TOKEN",
 *   "paths": {
 *     "products": "/products",
 *     "product":  "/products/{sku}",
 *     "inventory":"/inventory/{sku}",
 *     "price":    "/products/{sku}/price",
 *     "orders":   "/orders",
 *     "order":    "/orders/{ref}",
 *     "tracking": "/orders/{ref}/tracking"
 *   },
 *   "fields": {
 *     "sku": "sku", "title": "name", "cost": "price",
 *     "shipping": "shipping_fee", "stock": "quantity",
 *     "orderRef": "order_id", "orderStatus": "status",
 *     "trackingNumber": "tracking_number", "carrier": "carrier"
 *   },
 *   "statusMap": { "created": "processing", "in_transit": "shipped" },
 *   "costUnit": "major"   // "major" = 12.34, "minor" = 1234
 * }
 */

import { toCents } from '../money'
import {
  SupplierError,
  SupplierNotConfiguredError,
  type CreateSupplierOrderRequest,
  type InventoryLevel,
  type SupplierAdapter,
  type SupplierFulfillmentStatus,
  type SupplierOrderRef,
  type SupplierOrderStatus,
  type SupplierPrice,
  type SupplierProduct,
  type TrackingInfo,
} from './types'

export interface HttpAdapterConfig {
  baseUrl?: string
  authHeader?: string
  authScheme?: string
  tokenEnv?: string
  paths?: Record<string, string>
  fields?: Record<string, string>
  statusMap?: Record<string, SupplierFulfillmentStatus>
  costUnit?: 'major' | 'minor'
  currency?: string
}

const DEFAULT_FIELDS: Record<string, string> = {
  sku: 'sku',
  title: 'title',
  description: 'description',
  images: 'images',
  cost: 'cost',
  shipping: 'shipping',
  stock: 'stock',
  variants: 'variants',
  orderRef: 'order_id',
  orderStatus: 'status',
  trackingNumber: 'tracking_number',
  carrier: 'carrier',
  trackingUrl: 'tracking_url',
}

function pick(obj: unknown, key: string): unknown {
  if (typeof obj !== 'object' || obj === null) return undefined
  return (obj as Record<string, unknown>)[key]
}

export class HttpSupplierAdapter implements SupplierAdapter {
  readonly id = 'http'
  readonly status = 'REAL' as const
  readonly note =
    'Generic JSON supplier adapter driven by ds_suppliers.config. Verify field mappings against the supplier documentation before going live.'

  private readonly fields: Record<string, string>

  constructor(private readonly cfg: HttpAdapterConfig) {
    this.fields = { ...DEFAULT_FIELDS, ...(cfg.fields ?? {}) }
  }

  private token(): string {
    const env = this.cfg.tokenEnv
    const value = env ? process.env[env] : undefined
    if (!this.cfg.baseUrl || !env || !value) {
      throw new SupplierNotConfiguredError(
        'http',
        [
          !this.cfg.baseUrl ? 'ds_suppliers.config.baseUrl' : null,
          !env ? 'ds_suppliers.config.tokenEnv' : null,
          env && !value ? env : null,
        ].filter(Boolean) as string[]
      )
    }
    return value
  }

  private path(name: string, params: Record<string, string> = {}): string {
    const template = this.cfg.paths?.[name]
    if (!template) throw new SupplierNotConfiguredError('http', [`ds_suppliers.config.paths.${name}`])
    let p = template
    for (const [k, v] of Object.entries(params)) p = p.replace(`{${k}}`, encodeURIComponent(v))
    return `${this.cfg.baseUrl!.replace(/\/$/, '')}${p.startsWith('/') ? p : `/${p}`}`
  }

  private async request<T>(
    name: string,
    params: Record<string, string>,
    init?: RequestInit
  ): Promise<T> {
    const token = this.token()
    const url = this.path(name, params)
    const header = this.cfg.authHeader ?? 'Authorization'
    const scheme = this.cfg.authScheme ?? 'Bearer'

    let res: Response
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          [header]: scheme ? `${scheme} ${token}` : token,
          ...(init?.headers ?? {}),
        },
        cache: 'no-store',
      })
    } catch (err) {
      throw new SupplierError(`Network error calling ${url}`, err)
    }

    const text = await res.text()
    if (!res.ok) {
      throw new SupplierError(`${res.status} ${res.statusText} from ${url}: ${text.slice(0, 400)}`)
    }
    try {
      return JSON.parse(text) as T
    } catch (err) {
      throw new SupplierError(`Supplier returned non-JSON from ${url}`, err)
    }
  }

  private cost(value: unknown): number {
    if (value === undefined || value === null) return 0
    if (this.cfg.costUnit === 'minor') return Math.round(Number(value)) || 0
    return toCents(typeof value === 'number' ? value : String(value))
  }

  private mapStatus(raw: unknown): SupplierFulfillmentStatus {
    const key = String(raw ?? '').toLowerCase()
    const mapped = this.cfg.statusMap?.[key]
    if (mapped) return mapped
    if (['shipped', 'in_transit', 'dispatched'].includes(key)) return 'shipped'
    if (['delivered', 'completed'].includes(key)) return 'delivered'
    if (['cancelled', 'canceled'].includes(key)) return 'cancelled'
    if (['failed', 'error', 'rejected'].includes(key)) return 'failed'
    if (['pending', 'created', 'new'].includes(key)) return 'pending'
    return 'processing'
  }

  private toProduct(raw: unknown): SupplierProduct {
    const f = this.fields
    const variantsRaw = pick(raw, f.variants)
    const variants = Array.isArray(variantsRaw)
      ? variantsRaw.map((v) => ({
          supplierSku: String(pick(v, f.sku) ?? ''),
          title: String(pick(v, f.title) ?? 'Default'),
          costCents: this.cost(pick(v, f.cost)),
          stock: pick(v, f.stock) === undefined ? null : Number(pick(v, f.stock)),
        }))
      : []
    const imagesRaw = pick(raw, f.images)
    return {
      supplierSku: String(pick(raw, f.sku) ?? ''),
      title: String(pick(raw, f.title) ?? ''),
      description: String(pick(raw, f.description) ?? ''),
      imageUrls: Array.isArray(imagesRaw) ? imagesRaw.map(String) : [],
      costCents: this.cost(pick(raw, f.cost)),
      shippingCents: this.cost(pick(raw, f.shipping)),
      currency: this.cfg.currency ?? 'USD',
      leadDays: Number(pick(raw, 'lead_days') ?? 3),
      variants,
      sourceUrl: (pick(raw, 'url') as string) ?? null,
    }
  }

  async getProducts(query?: string): Promise<SupplierProduct[]> {
    const url = query ? `?q=${encodeURIComponent(query)}` : ''
    const data = await this.request<unknown>('products' + (url ? '' : ''), {}, undefined)
    const list = Array.isArray(data) ? data : (pick(data, 'data') as unknown[]) ?? []
    return list.map((r) => this.toProduct(r))
  }

  async getProduct(supplierSku: string): Promise<SupplierProduct | null> {
    const data = await this.request<unknown>('product', { sku: supplierSku })
    if (!data) return null
    const body = pick(data, 'data') ?? data
    return this.toProduct(body)
  }

  async getInventory(supplierSku: string): Promise<InventoryLevel> {
    const data = await this.request<unknown>('inventory', { sku: supplierSku })
    const body = pick(data, 'data') ?? data
    const raw = pick(body, this.fields.stock)
    return {
      supplierSku,
      available: raw === undefined || raw === null ? null : Number(raw),
      checkedAt: new Date().toISOString(),
    }
  }

  async getPrice(supplierSku: string): Promise<SupplierPrice> {
    const data = await this.request<unknown>('price', { sku: supplierSku })
    const body = pick(data, 'data') ?? data
    return {
      supplierSku,
      costCents: this.cost(pick(body, this.fields.cost)),
      shippingCents: this.cost(pick(body, this.fields.shipping)),
      currency: this.cfg.currency ?? 'USD',
      checkedAt: new Date().toISOString(),
    }
  }

  async createOrder(req: CreateSupplierOrderRequest): Promise<SupplierOrderRef> {
    const data = await this.request<unknown>(
      'orders',
      {},
      {
        method: 'POST',
        body: JSON.stringify({
          reference: req.reference,
          items: req.lines.map((l) => ({ sku: l.supplierSku, quantity: l.quantity })),
          shipping_address: {
            name: req.shippingAddress.name,
            line1: req.shippingAddress.line1,
            line2: req.shippingAddress.line2 ?? '',
            city: req.shippingAddress.city,
            state: req.shippingAddress.state ?? '',
            postal_code: req.shippingAddress.postalCode,
            country: req.shippingAddress.country,
            phone: req.shippingAddress.phone ?? '',
            email: req.shippingAddress.email ?? '',
          },
          note: req.note ?? '',
        }),
      }
    )
    const body = pick(data, 'data') ?? data
    const ref = pick(body, this.fields.orderRef)
    if (!ref) throw new SupplierError('Supplier accepted the order but returned no reference.')
    return {
      supplierRef: String(ref),
      status: this.mapStatus(pick(body, this.fields.orderStatus)),
      costCents: this.cost(pick(body, this.fields.cost)),
      raw: body,
    }
  }

  async getOrderStatus(supplierRef: string): Promise<SupplierOrderStatus> {
    const data = await this.request<unknown>('order', { ref: supplierRef })
    const body = pick(data, 'data') ?? data
    return {
      supplierRef,
      status: this.mapStatus(pick(body, this.fields.orderStatus)),
      message: (pick(body, 'message') as string) ?? undefined,
    }
  }

  async getTracking(supplierRef: string): Promise<TrackingInfo | null> {
    const data = await this.request<unknown>('tracking', { ref: supplierRef })
    const body = pick(data, 'data') ?? data
    const number = pick(body, this.fields.trackingNumber)
    if (!number) return null
    return {
      supplierRef,
      trackingNumber: String(number),
      carrier: (pick(body, this.fields.carrier) as string) ?? null,
      trackingUrl: (pick(body, this.fields.trackingUrl) as string) ?? null,
      shippedAt: (pick(body, 'shipped_at') as string) ?? null,
      deliveredAt: (pick(body, 'delivered_at') as string) ?? null,
    }
  }
}
