/**
 * DEMO DRIVER — in-process storage.
 *
 * This is NOT a database. It exists so the entire commerce system is runnable
 * and testable without any credentials. It is process-local and resets on every
 * restart. The ops dashboard renders a persistent DEMO DATA banner whenever
 * this driver is active, so it can never be mistaken for production storage.
 */

import type { Driver, Filter, QueryOpts } from './driver'
import { DbError } from './driver'

type Row = Record<string, unknown>

let idCounter = 0
function nextId(): string {
  idCounter += 1
  // Deterministic, UUID-shaped so it round-trips through the same code paths.
  const n = idCounter.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${n}`
}

function matches(row: Row, f: Filter): boolean {
  const v = row[f.column]
  switch (f.op) {
    case 'eq':
      return v === f.value
    case 'neq':
      return v !== f.value
    case 'in':
      return Array.isArray(f.value) && f.value.includes(v as never)
    case 'gte':
      return compare(v, f.value) >= 0
    case 'lte':
      return compare(v, f.value) <= 0
    case 'gt':
      return compare(v, f.value) > 0
    case 'lt':
      return compare(v, f.value) < 0
    case 'is':
      return f.value === null ? v === null || v === undefined : v === f.value
    case 'ilike': {
      const pattern = String(f.value).replace(/%/g, '').toLowerCase()
      return String(v ?? '').toLowerCase().includes(pattern)
    }
    default:
      return false
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''))
}

export class MemoryDriver implements Driver {
  readonly mode = 'memory' as const
  private tables = new Map<string, Row[]>()

  constructor(seed?: Record<string, Row[]>) {
    if (seed) {
      for (const [table, rows] of Object.entries(seed)) {
        this.tables.set(table, rows.map((r) => ({ ...r })))
      }
    }
  }

  private table(name: string): Row[] {
    let t = this.tables.get(name)
    if (!t) {
      t = []
      this.tables.set(name, t)
    }
    return t
  }

  private query(name: string, opts?: QueryOpts): Row[] {
    let rows = this.table(name).slice()
    for (const f of opts?.where ?? []) rows = rows.filter((r) => matches(r, f))
    if (opts?.order) {
      const { column, asc = true } = opts.order
      rows.sort((a, b) => (asc ? compare(a[column], b[column]) : compare(b[column], a[column])))
    }
    if (opts?.offset) rows = rows.slice(opts.offset)
    if (opts?.limit !== undefined) rows = rows.slice(0, opts.limit)
    return rows
  }

  async select<T>(table: string, opts?: QueryOpts): Promise<T[]> {
    return this.query(table, opts).map((r) => ({ ...r })) as T[]
  }

  async selectOne<T>(table: string, opts?: QueryOpts): Promise<T | null> {
    const [row] = this.query(table, { ...opts, limit: 1 })
    return row ? ({ ...row } as T) : null
  }

  async insert<T>(table: string, row: Row): Promise<T> {
    const now = new Date().toISOString()
    const record: Row = {
      id: nextId(),
      created_at: now,
      updated_at: now,
      ...row,
    }
    this.table(table).push(record)
    return { ...record } as T
  }

  async insertMany<T>(table: string, rows: Row[]): Promise<T[]> {
    const out: T[] = []
    for (const r of rows) out.push(await this.insert<T>(table, r))
    return out
  }

  async update<T>(table: string, id: string, patch: Row): Promise<T> {
    const rows = this.table(table)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new DbError(`${table}: no row with id ${id}`)
    rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() }
    return { ...rows[idx] } as T
  }

  async upsert<T>(table: string, row: Row, conflict: string[]): Promise<T> {
    const rows = this.table(table)
    const idx = rows.findIndex((r) => conflict.every((k) => r[k] === row[k]))
    if (idx === -1) return this.insert<T>(table, row)
    rows[idx] = { ...rows[idx], ...row, updated_at: new Date().toISOString() }
    return { ...rows[idx] } as T
  }

  async remove(table: string, id: string): Promise<void> {
    const rows = this.table(table)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx !== -1) rows.splice(idx, 1)
  }

  async count(table: string, opts?: QueryOpts): Promise<number> {
    return this.query(table, { ...opts, limit: undefined, offset: undefined }).length
  }
}
