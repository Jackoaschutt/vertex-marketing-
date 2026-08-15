/**
 * Repositories — the only API the rest of the commerce system uses to reach
 * storage. Nothing above this file knows whether it is talking to Postgres or
 * the demo driver.
 */

import { getDriver, TABLES } from './index'
import { eq, gte, inList, lte, type Filter } from './driver'
import type {
  AbandonedCart,
  AdMetric,
  CommerceEvent,
  Customer,
  EmailLogEntry,
  Expense,
  Fulfillment,
  Order,
  OrderItem,
  Product,
  ProductContent,
  ProductDetail,
  ProductImage,
  ProductStatus,
  ProductVariant,
  Recommendation,
  Supplier,
  SupplierProductLink,
} from '../types'

// --- Suppliers -------------------------------------------------------------

export async function listSuppliers(): Promise<Supplier[]> {
  return getDriver().select<Supplier>(TABLES.suppliers, { order: { column: 'name' } })
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  return getDriver().selectOne<Supplier>(TABLES.suppliers, { where: [eq('id', id)] })
}

export async function createSupplier(row: Partial<Supplier>): Promise<Supplier> {
  return getDriver().insert<Supplier>(TABLES.suppliers, row as Record<string, unknown>)
}

export async function updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier> {
  return getDriver().update<Supplier>(TABLES.suppliers, id, patch as Record<string, unknown>)
}

// --- Products --------------------------------------------------------------

export interface ProductQuery {
  published?: boolean
  status?: ProductStatus | ProductStatus[]
  category?: string
  sort?: 'position' | 'price_asc' | 'price_desc' | 'newest' | 'score'
  limit?: number
}

export async function listProducts(q: ProductQuery = {}): Promise<Product[]> {
  const where: Filter[] = []
  if (q.published !== undefined) where.push(eq('published', q.published))
  if (q.category) where.push(eq('category', q.category))
  if (Array.isArray(q.status)) where.push(inList('status', q.status))
  else if (q.status) where.push(eq('status', q.status))

  const order = (() => {
    switch (q.sort) {
      case 'price_asc':
        return { column: 'price_cents', asc: true }
      case 'price_desc':
        return { column: 'price_cents', asc: false }
      case 'newest':
        return { column: 'created_at', asc: false }
      case 'score':
        return { column: 'product_score', asc: false }
      default:
        return { column: 'position', asc: true }
    }
  })()

  return getDriver().select<Product>(TABLES.products, { where, order, limit: q.limit })
}

export async function getProductRow(id: string): Promise<Product | null> {
  return getDriver().selectOne<Product>(TABLES.products, { where: [eq('id', id)] })
}

export async function getProductRowBySlug(slug: string): Promise<Product | null> {
  return getDriver().selectOne<Product>(TABLES.products, { where: [eq('slug', slug)] })
}

async function assemble(product: Product): Promise<ProductDetail> {
  const db = getDriver()
  const [variants, images, contentRows, supplier] = await Promise.all([
    db.select<ProductVariant>(TABLES.variants, {
      where: [eq('product_id', product.id)],
      order: { column: 'position' },
    }),
    db.select<ProductImage>(TABLES.images, {
      where: [eq('product_id', product.id)],
      order: { column: 'position' },
    }),
    db.select<ProductContent>(TABLES.content, {
      where: [eq('product_id', product.id)],
      order: { column: 'version', asc: false },
      limit: 1,
    }),
    product.supplier_id
      ? db.selectOne<Supplier>(TABLES.suppliers, { where: [eq('id', product.supplier_id)] })
      : Promise.resolve(null),
  ])

  const latest = contentRows[0] ?? null
  return {
    product,
    variants,
    images,
    content: latest?.payload ?? null,
    contentMeta: latest
      ? { generator: latest.generator, isAi: latest.is_ai, model: latest.model }
      : null,
    supplier,
  }
}

export async function getProductDetailBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await getProductRowBySlug(slug)
  return product ? assemble(product) : null
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const product = await getProductRow(id)
  return product ? assemble(product) : null
}

export async function createProduct(row: Partial<Product>): Promise<Product> {
  return getDriver().insert<Product>(TABLES.products, row as Record<string, unknown>)
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  return getDriver().update<Product>(TABLES.products, id, patch as Record<string, unknown>)
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDriver()
  // The demo driver has no cascade, so children are removed explicitly. On
  // Postgres these are already ON DELETE CASCADE and this is a harmless no-op.
  for (const table of [TABLES.variants, TABLES.images, TABLES.content]) {
    const rows = await db.select<{ id: string }>(table, { where: [eq('product_id', id)] })
    for (const r of rows) await db.remove(table, r.id)
  }
  await db.remove(TABLES.products, id)
}

// --- Variants --------------------------------------------------------------

export async function listVariantsByIds(ids: string[]): Promise<ProductVariant[]> {
  if (ids.length === 0) return []
  return getDriver().select<ProductVariant>(TABLES.variants, { where: [inList('id', ids)] })
}

export async function listVariantsForProducts(productIds: string[]): Promise<ProductVariant[]> {
  if (productIds.length === 0) return []
  return getDriver().select<ProductVariant>(TABLES.variants, {
    where: [inList('product_id', productIds)],
    order: { column: 'position' },
  })
}

export async function listImagesForProducts(productIds: string[]): Promise<ProductImage[]> {
  if (productIds.length === 0) return []
  return getDriver().select<ProductImage>(TABLES.images, {
    where: [inList('product_id', productIds)],
    order: { column: 'position' },
  })
}

export async function createVariant(row: Partial<ProductVariant>): Promise<ProductVariant> {
  return getDriver().insert<ProductVariant>(TABLES.variants, row as Record<string, unknown>)
}

export async function updateVariant(
  id: string,
  patch: Partial<ProductVariant>
): Promise<ProductVariant> {
  return getDriver().update<ProductVariant>(TABLES.variants, id, patch as Record<string, unknown>)
}

export async function createImage(row: Partial<ProductImage>): Promise<ProductImage> {
  return getDriver().insert<ProductImage>(TABLES.images, row as Record<string, unknown>)
}

export async function saveContent(row: Partial<ProductContent>): Promise<ProductContent> {
  return getDriver().insert<ProductContent>(TABLES.content, row as Record<string, unknown>)
}

export async function supplierLinkForVariant(
  variantId: string
): Promise<SupplierProductLink | null> {
  return getDriver().selectOne<SupplierProductLink>(TABLES.supplierProducts, {
    where: [eq('variant_id', variantId), eq('is_primary', true)],
  })
}

export async function listSupplierLinks(): Promise<SupplierProductLink[]> {
  return getDriver().select<SupplierProductLink>(TABLES.supplierProducts)
}

export async function updateSupplierLink(
  id: string,
  patch: Partial<SupplierProductLink>
): Promise<SupplierProductLink> {
  return getDriver().update<SupplierProductLink>(
    TABLES.supplierProducts,
    id,
    patch as Record<string, unknown>
  )
}

// --- Customers -------------------------------------------------------------

export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  return getDriver().selectOne<Customer>(TABLES.customers, {
    where: [eq('email', email.toLowerCase())],
  })
}

export async function upsertCustomer(email: string, patch: Partial<Customer>): Promise<Customer> {
  const db = getDriver()
  const existing = await findCustomerByEmail(email)
  if (existing) return db.update<Customer>(TABLES.customers, existing.id, patch as Record<string, unknown>)
  return db.insert<Customer>(TABLES.customers, {
    email: email.toLowerCase(),
    ...patch,
  } as Record<string, unknown>)
}

export async function listCustomers(limit = 200): Promise<Customer[]> {
  return getDriver().select<Customer>(TABLES.customers, {
    order: { column: 'last_order_at', asc: false },
    limit,
  })
}

// --- Orders ----------------------------------------------------------------

export interface OrderQuery {
  status?: Order['status'] | Order['status'][]
  since?: string
  until?: string
  limit?: number
}

export async function listOrders(q: OrderQuery = {}): Promise<Order[]> {
  const where: Filter[] = []
  if (Array.isArray(q.status)) where.push(inList('status', q.status))
  else if (q.status) where.push(eq('status', q.status))
  if (q.since) where.push(gte('placed_at', q.since))
  if (q.until) where.push(lte('placed_at', q.until))
  return getDriver().select<Order>(TABLES.orders, {
    where,
    order: { column: 'placed_at', asc: false },
    limit: q.limit,
  })
}

export async function getOrder(id: string): Promise<Order | null> {
  return getDriver().selectOne<Order>(TABLES.orders, { where: [eq('id', id)] })
}

export async function getOrderByStripeSession(sessionId: string): Promise<Order | null> {
  return getDriver().selectOne<Order>(TABLES.orders, { where: [eq('stripe_session_id', sessionId)] })
}

export async function createOrder(row: Partial<Order>): Promise<Order> {
  return getDriver().insert<Order>(TABLES.orders, row as Record<string, unknown>)
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order> {
  return getDriver().update<Order>(TABLES.orders, id, patch as Record<string, unknown>)
}

export async function createOrderItems(rows: Partial<OrderItem>[]): Promise<OrderItem[]> {
  return getDriver().insertMany<OrderItem>(TABLES.orderItems, rows as Record<string, unknown>[])
}

export async function listOrderItems(orderId: string): Promise<OrderItem[]> {
  return getDriver().select<OrderItem>(TABLES.orderItems, { where: [eq('order_id', orderId)] })
}

export async function listOrderItemsForOrders(orderIds: string[]): Promise<OrderItem[]> {
  if (orderIds.length === 0) return []
  return getDriver().select<OrderItem>(TABLES.orderItems, { where: [inList('order_id', orderIds)] })
}

export async function listFulfillments(orderId: string): Promise<Fulfillment[]> {
  return getDriver().select<Fulfillment>(TABLES.fulfillments, { where: [eq('order_id', orderId)] })
}

export async function listAllFulfillments(limit = 500): Promise<Fulfillment[]> {
  return getDriver().select<Fulfillment>(TABLES.fulfillments, {
    order: { column: 'created_at', asc: false },
    limit,
  })
}

export async function createFulfillment(row: Partial<Fulfillment>): Promise<Fulfillment> {
  return getDriver().insert<Fulfillment>(TABLES.fulfillments, row as Record<string, unknown>)
}

export async function updateFulfillment(
  id: string,
  patch: Partial<Fulfillment>
): Promise<Fulfillment> {
  return getDriver().update<Fulfillment>(TABLES.fulfillments, id, patch as Record<string, unknown>)
}

export async function findFulfillmentByRef(ref: string): Promise<Fulfillment | null> {
  return getDriver().selectOne<Fulfillment>(TABLES.fulfillments, {
    where: [eq('supplier_ref', ref)],
  })
}

// --- Marketing & finance ---------------------------------------------------

export async function listAdMetrics(since?: string): Promise<AdMetric[]> {
  const where: Filter[] = []
  if (since) where.push(gte('day', since))
  return getDriver().select<AdMetric>(TABLES.adMetrics, {
    where,
    order: { column: 'day', asc: false },
  })
}

export async function upsertAdMetric(row: Partial<AdMetric>): Promise<AdMetric> {
  return getDriver().upsert<AdMetric>(TABLES.adMetrics, row as Record<string, unknown>, [
    'product_id',
    'channel',
    'campaign_ref',
    'day',
  ])
}

export async function listExpenses(since?: string): Promise<Expense[]> {
  const where: Filter[] = []
  if (since) where.push(gte('day', since))
  return getDriver().select<Expense>(TABLES.expenses, {
    where,
    order: { column: 'day', asc: false },
  })
}

export async function createExpense(row: Partial<Expense>): Promise<Expense> {
  return getDriver().insert<Expense>(TABLES.expenses, row as Record<string, unknown>)
}

// --- Automation output -----------------------------------------------------

export async function logEvent(row: Partial<CommerceEvent>): Promise<CommerceEvent> {
  return getDriver().insert<CommerceEvent>(TABLES.events, {
    level: 'info',
    data: {},
    ...row,
  } as Record<string, unknown>)
}

export async function listEvents(limit = 100, level?: CommerceEvent['level']): Promise<CommerceEvent[]> {
  const where: Filter[] = []
  if (level) where.push(eq('level', level))
  return getDriver().select<CommerceEvent>(TABLES.events, {
    where,
    order: { column: 'created_at', asc: false },
    limit,
  })
}

export async function createRecommendation(row: Partial<Recommendation>): Promise<Recommendation> {
  return getDriver().insert<Recommendation>(TABLES.recommendations, row as Record<string, unknown>)
}

export async function listRecommendations(
  status: Recommendation['status'] = 'open'
): Promise<Recommendation[]> {
  return getDriver().select<Recommendation>(TABLES.recommendations, {
    where: [eq('status', status)],
    order: { column: 'created_at', asc: false },
  })
}

export async function updateRecommendation(
  id: string,
  patch: Partial<Recommendation>
): Promise<Recommendation> {
  return getDriver().update<Recommendation>(
    TABLES.recommendations,
    id,
    patch as Record<string, unknown>
  )
}

/** Replaces the open recommendation set for a run so they do not accumulate. */
export async function clearOpenRecommendations(): Promise<void> {
  const db = getDriver()
  const open = await listRecommendations('open')
  for (const r of open) await db.remove(TABLES.recommendations, r.id)
}

// --- Email -----------------------------------------------------------------

export async function findEmailLog(
  orderId: string | null,
  template: string
): Promise<EmailLogEntry | null> {
  if (!orderId) return null
  return getDriver().selectOne<EmailLogEntry>(TABLES.emailLog, {
    where: [eq('order_id', orderId), eq('template', template)],
  })
}

export async function recordEmail(row: Partial<EmailLogEntry>): Promise<EmailLogEntry> {
  return getDriver().insert<EmailLogEntry>(TABLES.emailLog, row as Record<string, unknown>)
}

export async function listEmailLog(limit = 100): Promise<EmailLogEntry[]> {
  return getDriver().select<EmailLogEntry>(TABLES.emailLog, {
    order: { column: 'created_at', asc: false },
    limit,
  })
}

// --- Abandoned carts -------------------------------------------------------

export async function recordAbandonedCart(row: Partial<AbandonedCart>): Promise<AbandonedCart> {
  return getDriver().insert<AbandonedCart>(TABLES.abandonedCarts, row as Record<string, unknown>)
}

export async function listAbandonedCarts(limit = 100): Promise<AbandonedCart[]> {
  return getDriver().select<AbandonedCart>(TABLES.abandonedCarts, {
    where: [eq('recovered', false)],
    order: { column: 'created_at', asc: false },
    limit,
  })
}

export async function updateAbandonedCart(
  id: string,
  patch: Partial<AbandonedCart>
): Promise<AbandonedCart> {
  return getDriver().update<AbandonedCart>(
    TABLES.abandonedCarts,
    id,
    patch as Record<string, unknown>
  )
}

// --- Settings --------------------------------------------------------------

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await getDriver().selectOne<{ key: string; value: unknown }>(TABLES.settings, {
    where: [eq('key', key)],
  })
  return row === null || row.value === undefined || row.value === null ? fallback : (row.value as T)
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await getDriver().upsert(TABLES.settings, { key, value }, ['key'])
}
