/**
 * Repositories — the only API the rest of the system uses to reach storage.
 * Nothing above this file knows whether it is talking to Postgres or the demo
 * driver.
 */

import { getDriver, TABLES } from './index'
import { eq, gte, inList, lte, type Filter } from './driver'
import type {
  AdMetric,
  ChecklistProgress,
  CommerceEvent,
  Expense,
  PlaybookNote,
  Postmortem,
  Product,
  ProductContent,
  ProductDetail,
  ProductImage,
  ProductStatus,
  Recommendation,
  ResearchSignal,
  SaleEntry,
  Supplier,
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
  status?: ProductStatus | ProductStatus[]
  category?: string
  sort?: 'score' | 'newest' | 'name'
  limit?: number
}

export async function listProducts(q: ProductQuery = {}): Promise<Product[]> {
  const where: Filter[] = []
  if (q.category) where.push(eq('category', q.category))
  if (Array.isArray(q.status)) where.push(inList('status', q.status))
  else if (q.status) where.push(eq('status', q.status))

  const order =
    q.sort === 'newest'
      ? { column: 'created_at', asc: false }
      : q.sort === 'name'
        ? { column: 'name', asc: true }
        : { column: 'product_score', asc: false }

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
  const [images, contentRows, supplier] = await Promise.all([
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
  for (const table of [
    TABLES.images,
    TABLES.content,
    TABLES.sales,
    TABLES.checklist,
    TABLES.postmortems,
    TABLES.signals,
  ]) {
    const rows = await db.select<{ id: string }>(table, { where: [eq('product_id', id)] })
    for (const r of rows) await db.remove(table, r.id)
  }
  await db.remove(TABLES.products, id)
}

export async function listImagesForProducts(productIds: string[]): Promise<ProductImage[]> {
  if (productIds.length === 0) return []
  return getDriver().select<ProductImage>(TABLES.images, {
    where: [inList('product_id', productIds)],
    order: { column: 'position' },
  })
}

export async function createImage(row: Partial<ProductImage>): Promise<ProductImage> {
  return getDriver().insert<ProductImage>(TABLES.images, row as Record<string, unknown>)
}

export async function saveContent(row: Partial<ProductContent>): Promise<ProductContent> {
  return getDriver().insert<ProductContent>(TABLES.content, row as Record<string, unknown>)
}

// --- Sales ledger ----------------------------------------------------------
// Hand-entered, one row per product per channel per day. This is the only
// source of revenue truth in the system.

export async function listSales(since?: string, until?: string): Promise<SaleEntry[]> {
  const where: Filter[] = []
  if (since) where.push(gte('day', since))
  if (until) where.push(lte('day', until))
  return getDriver().select<SaleEntry>(TABLES.sales, {
    where,
    order: { column: 'day', asc: false },
  })
}

export async function listSalesForProduct(productId: string): Promise<SaleEntry[]> {
  return getDriver().select<SaleEntry>(TABLES.sales, {
    where: [eq('product_id', productId)],
    order: { column: 'day', asc: false },
  })
}

/**
 * Upserts on (day, product_id, channel), so re-entering a day corrects it
 * instead of double-counting. Getting this wrong would silently inflate
 * revenue, which is the worst thing a bookkeeping tool can do.
 */
export async function upsertSale(row: Partial<SaleEntry>): Promise<SaleEntry> {
  return getDriver().upsert<SaleEntry>(TABLES.sales, row as Record<string, unknown>, [
    'day',
    'product_id',
    'channel',
  ])
}

export async function deleteSale(id: string): Promise<void> {
  return getDriver().remove(TABLES.sales, id)
}

// --- Playbook --------------------------------------------------------------

export async function listNotes(productId?: string): Promise<PlaybookNote[]> {
  const where: Filter[] = []
  if (productId) where.push(eq('product_id', productId))
  return getDriver().select<PlaybookNote>(TABLES.notes, {
    where,
    order: { column: 'created_at', asc: false },
  })
}

export async function getNote(id: string): Promise<PlaybookNote | null> {
  return getDriver().selectOne<PlaybookNote>(TABLES.notes, { where: [eq('id', id)] })
}

export async function createNote(row: Partial<PlaybookNote>): Promise<PlaybookNote> {
  return getDriver().insert<PlaybookNote>(TABLES.notes, row as Record<string, unknown>)
}

export async function updateNote(id: string, patch: Partial<PlaybookNote>): Promise<PlaybookNote> {
  return getDriver().update<PlaybookNote>(TABLES.notes, id, patch as Record<string, unknown>)
}

export async function deleteNote(id: string): Promise<void> {
  return getDriver().remove(TABLES.notes, id)
}

// --- Stage checklists ------------------------------------------------------

export async function listChecklist(productId: string): Promise<ChecklistProgress[]> {
  return getDriver().select<ChecklistProgress>(TABLES.checklist, {
    where: [eq('product_id', productId)],
  })
}

export async function listAllChecklistProgress(): Promise<ChecklistProgress[]> {
  return getDriver().select<ChecklistProgress>(TABLES.checklist)
}

export async function setChecklistItem(row: Partial<ChecklistProgress>): Promise<ChecklistProgress> {
  return getDriver().upsert<ChecklistProgress>(TABLES.checklist, row as Record<string, unknown>, [
    'product_id',
    'stage',
    'item_key',
  ])
}

// --- Post-mortems ----------------------------------------------------------

export async function getPostmortem(productId: string): Promise<Postmortem | null> {
  return getDriver().selectOne<Postmortem>(TABLES.postmortems, {
    where: [eq('product_id', productId)],
  })
}

export async function listPostmortems(): Promise<Postmortem[]> {
  return getDriver().select<Postmortem>(TABLES.postmortems, {
    order: { column: 'created_at', asc: false },
  })
}

export async function savePostmortem(row: Partial<Postmortem>): Promise<Postmortem> {
  return getDriver().upsert<Postmortem>(TABLES.postmortems, row as Record<string, unknown>, [
    'product_id',
  ])
}

// --- Research signals ------------------------------------------------------

export async function listSignals(productId?: string): Promise<ResearchSignal[]> {
  const where: Filter[] = []
  if (productId) where.push(eq('product_id', productId))
  return getDriver().select<ResearchSignal>(TABLES.signals, {
    where,
    order: { column: 'collected_at', asc: false },
  })
}

export async function saveSignal(row: Partial<ResearchSignal>): Promise<ResearchSignal> {
  return getDriver().upsert<ResearchSignal>(TABLES.signals, row as Record<string, unknown>, [
    'product_id',
    'keyword',
    'source',
  ])
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
