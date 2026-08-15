/**
 * Storage driver contract.
 *
 * Two implementations exist:
 *   - driver-supabase.ts  REAL — Postgres via the service-role key (server only)
 *   - driver-memory.ts    DEMO — seeded in-process arrays, used when no database
 *                         is configured so the app runs and can be tested with
 *                         zero credentials. Process-local; resets on restart.
 *
 * Repositories above this layer never import a driver directly — they call
 * getDriver() from ./index.
 */

export type FilterOp = 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'gt' | 'lt' | 'is' | 'ilike'

export interface Filter {
  column: string
  op: FilterOp
  value: unknown
}

export interface QueryOpts {
  where?: Filter[]
  order?: { column: string; asc?: boolean }
  limit?: number
  offset?: number
}

export interface Driver {
  readonly mode: 'supabase' | 'memory'
  select<T>(table: string, opts?: QueryOpts): Promise<T[]>
  selectOne<T>(table: string, opts?: QueryOpts): Promise<T | null>
  insert<T>(table: string, row: Record<string, unknown>): Promise<T>
  insertMany<T>(table: string, rows: Record<string, unknown>[]): Promise<T[]>
  update<T>(table: string, id: string, patch: Record<string, unknown>): Promise<T>
  /** Insert or update on a unique key set. Returns the resulting row. */
  upsert<T>(table: string, row: Record<string, unknown>, conflict: string[]): Promise<T>
  remove(table: string, id: string): Promise<void>
  count(table: string, opts?: QueryOpts): Promise<number>
}

export const eq = (column: string, value: unknown): Filter => ({ column, op: 'eq', value })
export const inList = (column: string, value: unknown[]): Filter => ({ column, op: 'in', value })
export const gte = (column: string, value: unknown): Filter => ({ column, op: 'gte', value })
export const lte = (column: string, value: unknown): Filter => ({ column, op: 'lte', value })

export class DbError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'DbError'
  }
}
