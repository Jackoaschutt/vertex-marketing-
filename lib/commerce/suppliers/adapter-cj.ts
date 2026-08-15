/**
 * CJDROPSHIPPING ADAPTER — STATUS: REAL, UNVERIFIED.
 *
 * ⚠️ Read this before trusting it.
 *
 * This adapter issues real HTTP requests against CJdropshipping's published
 * Developer API v2 (https://developers.cjdropshipping.com). It is written to
 * the request/response shapes documented there, but it has NOT been executed
 * against a live CJ account from this repository — no credentials were
 * available. Endpoint paths and field names should be verified against your
 * account's API documentation, and a single low-value test order placed end to
 * end, before any customer order is routed through it.
 *
 * It is deliberately NOT the default adapter. Without CJ_EMAIL and CJ_API_KEY
 * it throws SupplierNotConfiguredError; it never falls back to fabricated data.
 *
 * Response envelope assumed throughout: { code, result, message, data }.
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

const BASE = process.env.CJ_API_BASE ?? 'https://developers.cjdropshipping.com/api2.0/v1'

interface CjEnvelope<T> {
  code: number
  result: boolean
  message: string
  data: T
}

// CJ access tokens are long-lived; cache in-process and refresh on expiry.
let tokenCache: { token: string; expiresAt: number } | null = null

function credentials(): { email: string; apiKey: string } {
  const email = process.env.CJ_EMAIL
  const apiKey = process.env.CJ_API_KEY
  if (!email || !apiKey) {
    throw new SupplierNotConfiguredError('cj', [
      ...(email ? [] : ['CJ_EMAIL']),
      ...(apiKey ? [] : ['CJ_API_KEY']),
    ])
  }
  return { email, apiKey }
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token
  const { email, apiKey } = credentials()

  const res = await fetch(`${BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey }),
    cache: 'no-store',
  }).catch((err) => {
    throw new SupplierError('Network error authenticating with CJdropshipping', err)
  })

  const body = (await res.json().catch(() => null)) as CjEnvelope<{
    accessToken?: string
    accessTokenExpiryDate?: string
  }> | null

  if (!res.ok || !body?.result || !body.data?.accessToken) {
    throw new SupplierError(
      `CJ authentication failed (${res.status}): ${body?.message ?? 'no token returned'}`
    )
  }

  const expiry = body.data.accessTokenExpiryDate
    ? Date.parse(body.data.accessTokenExpiryDate)
    : Date.now() + 6 * 86_400_000
  tokenCache = { token: body.data.accessToken, expiresAt: Number.isFinite(expiry) ? expiry : Date.now() + 3_600_000 }
  return tokenCache.token
}

async function cjRequest<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number> }
): Promise<T> {
  const token = await accessToken()
  const qs = init?.query
    ? `?${new URLSearchParams(
        Object.entries(init.query).map(([k, v]) => [k, String(v)])
      ).toString()}`
    : ''
  const url = `${BASE}${path}${qs}`

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  }).catch((err) => {
    throw new SupplierError(`Network error calling CJ ${path}`, err)
  })

  const text = await res.text()
  let body: CjEnvelope<T> | null = null
  try {
    body = JSON.parse(text) as CjEnvelope<T>
  } catch {
    throw new SupplierError(`CJ returned non-JSON from ${path}: ${text.slice(0, 300)}`)
  }
  if (!res.ok || body.result === false) {
    // 1600200 is CJ's documented "token expired" code — drop the cache so the
    // next call re-authenticates rather than looping on a stale token.
    if (body.code === 1600200) tokenCache = null
    throw new SupplierError(`CJ ${path} failed (${res.status}/${body.code}): ${body.message}`)
  }
  return body.data
}

function mapStatus(raw: string | undefined): SupplierFulfillmentStatus {
  const s = String(raw ?? '').toUpperCase()
  if (s.includes('CANCEL')) return 'cancelled'
  if (s.includes('DELIVERED')) return 'delivered'
  if (s.includes('SHIPPED') || s.includes('TRANSIT') || s.includes('DISPATCH')) return 'shipped'
  if (s.includes('UNPAID') || s.includes('CREATED')) return 'pending'
  if (s.includes('FAIL') || s.includes('REJECT')) return 'failed'
  return 'processing'
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class CjSupplierAdapter implements SupplierAdapter {
  readonly id = 'cj'
  readonly status = 'REAL' as const
  readonly note =
    'CJdropshipping API v2. Written to published API shapes but NOT verified against a live account — place one test order before routing customer orders through it.'

  async getProducts(query?: string): Promise<SupplierProduct[]> {
    const data = await cjRequest<{ list?: any[] }>('/product/list', {
      query: { pageNum: 1, pageSize: 20, ...(query ? { productNameEn: query } : {}) },
    })
    return (data.list ?? []).map((p) => this.toProduct(p))
  }

  async getProduct(supplierSku: string): Promise<SupplierProduct | null> {
    const data = await cjRequest<any>('/product/query', { query: { pid: supplierSku } })
    return data ? this.toProduct(data) : null
  }

  private toProduct(p: any): SupplierProduct {
    const variants: any[] = Array.isArray(p?.variants) ? p.variants : []
    return {
      supplierSku: String(p?.pid ?? p?.productId ?? ''),
      title: String(p?.productNameEn ?? p?.productName ?? ''),
      description: String(p?.description ?? ''),
      imageUrls: Array.isArray(p?.productImageSet) ? p.productImageSet.map(String) : [],
      costCents: toCents(String(p?.sellPrice ?? p?.productPrice ?? '0')),
      shippingCents: 0, // CJ quotes freight separately via its logistics endpoint
      currency: 'USD',
      leadDays: Number(p?.productProcessingTime ?? 3),
      variants: variants.map((v) => ({
        supplierSku: String(v?.vid ?? ''),
        title: String(v?.variantNameEn ?? v?.variantKey ?? 'Default'),
        costCents: toCents(String(v?.variantSellPrice ?? '0')),
        stock: v?.variantStandard === undefined ? null : Number(v?.variantStock ?? 0),
      })),
      sourceUrl: p?.productUrl ? String(p.productUrl) : null,
    }
  }

  async getInventory(supplierSku: string): Promise<InventoryLevel> {
    const data = await cjRequest<any>('/product/stock/queryByVid', { query: { vid: supplierSku } })
    const rows: any[] = Array.isArray(data) ? data : (data?.list ?? [])
    const total = rows.reduce((sum, r) => sum + Number(r?.storageNum ?? r?.quantity ?? 0), 0)
    return {
      supplierSku,
      available: rows.length === 0 ? null : total,
      checkedAt: new Date().toISOString(),
    }
  }

  async getPrice(supplierSku: string): Promise<SupplierPrice> {
    const product = await this.getProduct(supplierSku)
    const variant = product?.variants.find((v) => v.supplierSku === supplierSku)
    if (!product) throw new SupplierError(`CJ product ${supplierSku} not found.`)
    return {
      supplierSku,
      costCents: variant?.costCents ?? product.costCents,
      shippingCents: product.shippingCents,
      currency: 'USD',
      checkedAt: new Date().toISOString(),
    }
  }

  async createOrder(req: CreateSupplierOrderRequest): Promise<SupplierOrderRef> {
    const data = await cjRequest<any>('/shopping/order/createOrderV2', {
      method: 'POST',
      body: JSON.stringify({
        orderNumber: req.reference,
        shippingCountryCode: req.shippingAddress.country,
        shippingProvince: req.shippingAddress.state ?? '',
        shippingCity: req.shippingAddress.city,
        shippingAddress: req.shippingAddress.line1,
        shippingAddress2: req.shippingAddress.line2 ?? '',
        shippingCustomerName: req.shippingAddress.name,
        shippingZip: req.shippingAddress.postalCode,
        shippingPhone: req.shippingAddress.phone ?? '',
        remark: req.note ?? '',
        fromCountryCode: 'CN',
        products: req.lines.map((l) => ({ vid: l.supplierSku, quantity: l.quantity })),
      }),
    })
    const ref = data?.orderId ?? data?.orderNum
    if (!ref) throw new SupplierError('CJ accepted the order but returned no order id.')
    return {
      supplierRef: String(ref),
      status: mapStatus(data?.orderStatus),
      costCents: toCents(String(data?.orderAmount ?? '0')),
      raw: data,
    }
  }

  async getOrderStatus(supplierRef: string): Promise<SupplierOrderStatus> {
    const data = await cjRequest<any>('/shopping/order/getOrderDetail', {
      query: { orderId: supplierRef },
    })
    return {
      supplierRef,
      status: mapStatus(data?.orderStatus),
      message: data?.orderStatus ? String(data.orderStatus) : undefined,
    }
  }

  async getTracking(supplierRef: string): Promise<TrackingInfo | null> {
    const detail = await cjRequest<any>('/shopping/order/getOrderDetail', {
      query: { orderId: supplierRef },
    })
    const number = detail?.trackNumber ?? detail?.trackingNumber
    if (!number) return null
    return {
      supplierRef,
      trackingNumber: String(number),
      carrier: detail?.logisticName ? String(detail.logisticName) : null,
      trackingUrl: `https://www.17track.net/en/track?nums=${encodeURIComponent(String(number))}`,
      shippedAt: detail?.createDate ? String(detail.createDate) : null,
      deliveredAt: mapStatus(detail?.orderStatus) === 'delivered' ? new Date().toISOString() : null,
    }
  }
}
