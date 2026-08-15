/**
 * Shared helpers for /api/commerce route handlers: JSON responses, error
 * translation, and a sliding-window rate limiter.
 */

import { NextResponse } from 'next/server'
import { NotAuthorizedError, adminDeniedMessage } from './auth'
import { ValidationError } from './validate'
import { DbError } from './db/driver'
import { SupplierNotConfiguredError, SupplierError } from './suppliers/types'

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init)
}

export function fail(status: number, error: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, ...extra }, { status })
}

/**
 * Translates a thrown error into a response. Nothing is swallowed: unexpected
 * errors are logged server-side and reported as a 500 with a stable message,
 * never as a fake success.
 */
export function handleError(err: unknown, context: string): NextResponse {
  if (err instanceof ValidationError) {
    return fail(400, 'Invalid request.', { issues: err.issues })
  }
  if (err instanceof NotAuthorizedError) {
    return fail(403, adminDeniedMessage(String(err.reason)))
  }
  if (err instanceof SupplierNotConfiguredError) {
    return fail(503, err.message, { requires: err.requires })
  }
  if (err instanceof SupplierError) {
    return fail(502, `Supplier error: ${err.message}`)
  }
  if (err instanceof DbError) {
    console.error(`[commerce:${context}] database error`, err)
    return fail(500, 'A database error occurred. See server logs.')
  }
  console.error(`[commerce:${context}] unhandled error`, err)
  return fail(500, 'Unexpected server error. See server logs.')
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ValidationError(['Request body must be valid JSON.'])
  }
}

// --- Rate limiting ---------------------------------------------------------

const buckets = new Map<string, number[]>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/**
 * In-process sliding-window limiter.
 *
 * Adequate for a single-instance deployment and for blunting scripted abuse.
 * It is NOT a distributed limiter — on multi-instance hosting each instance
 * keeps its own window, so set limits accordingly or put a real limiter at the
 * edge.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    const retryAfterSeconds = Math.ceil((windowMs - (now - hits[0])) / 1000)
    buckets.set(key, hits)
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) }
  }
  hits.push(now)
  buckets.set(key, hits)
  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return { allowed: true, retryAfterSeconds: 0 }
}

export function clientKey(request: Request, suffix: string): string {
  const fwd = request.headers.get('x-forwarded-for') ?? ''
  const ip = fwd.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `${suffix}:${ip}`
}

export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
}
