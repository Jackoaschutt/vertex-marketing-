/**
 * Adapter registry — resolves a Supplier row to a SupplierAdapter instance.
 *
 * Swapping a supplier for a product is a database update (change
 * ds_suppliers.adapter / .config), never a code change.
 */

import type { Supplier } from '../types'
import { CjSupplierAdapter } from './adapter-cj'
import { HttpSupplierAdapter, type HttpAdapterConfig } from './adapter-http'
import { MockSupplierAdapter } from './adapter-mock'
import type { SupplierAdapter } from './types'

const mock = new MockSupplierAdapter()
const cj = new CjSupplierAdapter()

export function adapterFor(supplier: Supplier | null): SupplierAdapter {
  if (!supplier) return mock
  switch (supplier.adapter) {
    case 'cj':
      return cj
    case 'http':
      return new HttpSupplierAdapter(supplier.config as HttpAdapterConfig)
    case 'mock':
    default:
      return mock
  }
}

export const ADAPTER_CATALOGUE: {
  id: string
  label: string
  status: 'REAL' | 'MOCK'
  requires: string[]
  note: string
}[] = [
  {
    id: 'mock',
    label: 'Mock supplier (demo)',
    status: 'MOCK',
    requires: [],
    note: 'Simulated fulfilment. Safe for development, never for real orders.',
  },
  {
    id: 'cj',
    label: 'CJdropshipping',
    status: 'REAL',
    requires: ['CJ_EMAIL', 'CJ_API_KEY'],
    note: 'Written to CJ Developer API v2 shapes. UNVERIFIED against a live account — place a test order first.',
  },
  {
    id: 'http',
    label: 'Generic JSON API',
    status: 'REAL',
    requires: ['ds_suppliers.config.baseUrl', 'ds_suppliers.config.tokenEnv', '<the named env var>'],
    note: 'Config-driven adapter for any supplier with a JSON API. Preferred over forking the codebase.',
  },
]
