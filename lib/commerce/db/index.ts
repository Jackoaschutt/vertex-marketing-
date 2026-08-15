import { config } from '../config'
import type { Driver } from './driver'
import { MemoryDriver } from './driver-memory'
import { SupabaseDriver } from './driver-supabase'
import { buildSeed } from './seed'

export * from './driver'

let driver: Driver | null = null

/**
 * Resolves the storage driver once per process.
 *
 * With Supabase credentials → REAL Postgres.
 * Without them → seeded MemoryDriver (DEMO). config.demoMode reports which,
 * and the ops dashboard surfaces it to the operator.
 */
export function getDriver(): Driver {
  if (driver) return driver
  driver = config.databaseConfigured ? new SupabaseDriver() : new MemoryDriver(buildSeed())
  return driver
}

/** Test hook: swap in a clean driver. Not used by application code. */
export function __setDriver(next: Driver | null): void {
  driver = next
}

export const TABLES = {
  suppliers: 'ds_suppliers',
  products: 'ds_products',
  variants: 'ds_product_variants',
  images: 'ds_product_images',
  content: 'ds_product_content',
  supplierProducts: 'ds_supplier_products',
  customers: 'ds_customers',
  orders: 'ds_orders',
  orderItems: 'ds_order_items',
  fulfillments: 'ds_fulfillments',
  adMetrics: 'ds_ad_metrics',
  expenses: 'ds_expenses',
  recommendations: 'ds_recommendations',
  events: 'ds_events',
  emailLog: 'ds_email_log',
  abandonedCarts: 'ds_abandoned_carts',
  settings: 'ds_settings',
} as const
