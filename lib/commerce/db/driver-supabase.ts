/**
 * REAL DRIVER — Supabase Postgres via the service-role key.
 *
 * This is the ONLY module in the commerce system that touches
 * SUPABASE_SERVICE_ROLE_KEY. It must never be imported from a Client Component.
 * The key is read lazily from process.env inside getClient(), and every module
 * that reaches this file is a Server Component or Route Handler — verified by
 * `npm run check:server-only`, which fails the build if a "use client" module
 * transitively imports the commerce data layer.
 *
 * Every ds_ table has RLS enabled with no permissive policies, so the anon key
 * can read nothing. The service-role key bypasses RLS and is the sole path in.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Driver, QueryOpts } from './driver'
import { DbError } from './driver'

type Row = Record<string, unknown>

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new DbError(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return client
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(builder: any, opts?: QueryOpts) {
  let q = builder
  for (const f of opts?.where ?? []) {
    switch (f.op) {
      case 'eq':
        q = q.eq(f.column, f.value)
        break
      case 'neq':
        q = q.neq(f.column, f.value)
        break
      case 'in':
        q = q.in(f.column, f.value as unknown[])
        break
      case 'gte':
        q = q.gte(f.column, f.value)
        break
      case 'lte':
        q = q.lte(f.column, f.value)
        break
      case 'gt':
        q = q.gt(f.column, f.value)
        break
      case 'lt':
        q = q.lt(f.column, f.value)
        break
      case 'is':
        q = q.is(f.column, f.value)
        break
      case 'ilike':
        q = q.ilike(f.column, `%${String(f.value)}%`)
        break
    }
  }
  if (opts?.order) q = q.order(opts.order.column, { ascending: opts.order.asc ?? true })
  if (opts?.offset !== undefined && opts?.limit !== undefined) {
    q = q.range(opts.offset, opts.offset + opts.limit - 1)
  } else if (opts?.limit !== undefined) {
    q = q.limit(opts.limit)
  }
  return q
}

export class SupabaseDriver implements Driver {
  readonly mode = 'supabase' as const

  async select<T>(table: string, opts?: QueryOpts): Promise<T[]> {
    const { data, error } = await applyFilters(getClient().from(table).select('*'), opts)
    if (error) throw new DbError(`select ${table}: ${error.message}`, error)
    return (data ?? []) as T[]
  }

  async selectOne<T>(table: string, opts?: QueryOpts): Promise<T | null> {
    const rows = await this.select<T>(table, { ...opts, limit: 1 })
    return rows[0] ?? null
  }

  async insert<T>(table: string, row: Row): Promise<T> {
    const { data, error } = await getClient().from(table).insert(row).select().single()
    if (error) throw new DbError(`insert ${table}: ${error.message}`, error)
    return data as T
  }

  async insertMany<T>(table: string, rows: Row[]): Promise<T[]> {
    if (rows.length === 0) return []
    const { data, error } = await getClient().from(table).insert(rows).select()
    if (error) throw new DbError(`insertMany ${table}: ${error.message}`, error)
    return (data ?? []) as T[]
  }

  async update<T>(table: string, id: string, patch: Row): Promise<T> {
    const { data, error } = await getClient()
      .from(table)
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new DbError(`update ${table}: ${error.message}`, error)
    return data as T
  }

  async upsert<T>(table: string, row: Row, conflict: string[]): Promise<T> {
    const { data, error } = await getClient()
      .from(table)
      .upsert(row, { onConflict: conflict.join(',') })
      .select()
      .single()
    if (error) throw new DbError(`upsert ${table}: ${error.message}`, error)
    return data as T
  }

  async remove(table: string, id: string): Promise<void> {
    const { error } = await getClient().from(table).delete().eq('id', id)
    if (error) throw new DbError(`delete ${table}: ${error.message}`, error)
  }

  async count(table: string, opts?: QueryOpts): Promise<number> {
    const { count, error } = await applyFilters(
      getClient().from(table).select('id', { count: 'exact', head: true }),
      { ...opts, limit: undefined, offset: undefined, order: undefined }
    )
    if (error) throw new DbError(`count ${table}: ${error.message}`, error)
    return count ?? 0
  }
}
