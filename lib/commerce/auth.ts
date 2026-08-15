/**
 * Access control for a single-operator tool.
 *
 * This used to be Supabase Auth plus an email allowlist, which made sense when
 * the app had customers. It has one user, so that was two moving parts and an
 * account to maintain for no benefit. It is now one passcode.
 *
 * How it works:
 *   - ADMIN_PASSCODE is the only secret. It never leaves the server.
 *   - Unlocking sets a cookie whose value is an HMAC derived from the passcode,
 *     not the passcode itself. The cookie cannot be forged without the secret,
 *     and changing the passcode invalidates every existing session for free.
 *   - Comparison is constant-time, so the token cannot be recovered by timing.
 *
 * An unset ADMIN_PASSCODE denies everyone. That is deliberate: the failure mode
 * of a misconfigured deployment must be "nobody gets in", never "everybody
 * does" — this thing holds the owner's real financials.
 */

import { createHmac } from 'node:crypto'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'ops_session'
/** 30 days. Long, because re-entering a passcode daily trains you to pick a weak one. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export interface AdminIdentity {
  /** There is exactly one user. Kept as a field so event logs read naturally. */
  email: string
}

export type AdminCheck =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; reason: 'no_passcode_set' | 'locked' }

export function isPasscodeConfigured(): boolean {
  const p = process.env.ADMIN_PASSCODE
  return typeof p === 'string' && p.trim().length > 0
}

/**
 * The cookie value for the configured passcode.
 *
 * Derived rather than stored, so there is no session table to keep and no
 * second secret to leak. Returns null when no passcode is configured, which
 * makes every comparison below fail closed.
 */
export function sessionToken(): string | null {
  const passcode = process.env.ADMIN_PASSCODE
  if (!passcode || passcode.trim().length === 0) return null
  return createHmac('sha256', passcode).update('ops-session-v1').digest('hex')
}

export function timingSafeEqual(a: string, b: string): boolean {
  // Length is not secret here; comparing unequal lengths in constant time still
  // avoids leaking *where* the mismatch is.
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

/** True when the supplied passcode matches the configured one. */
export function passcodeMatches(supplied: string): boolean {
  const expected = process.env.ADMIN_PASSCODE
  if (!expected || expected.trim().length === 0) return false
  return timingSafeEqual(supplied, expected)
}

export async function checkAdmin(): Promise<AdminCheck> {
  const expected = sessionToken()
  if (!expected) return { ok: false, reason: 'no_passcode_set' }

  const jar = await cookies()
  const presented = jar.get(SESSION_COOKIE)?.value ?? ''
  if (!presented || !timingSafeEqual(presented, expected)) {
    return { ok: false, reason: 'locked' }
  }
  return { ok: true, identity: { email: 'owner' } }
}

export class NotAuthorizedError extends Error {
  constructor(readonly reason: string) {
    super(`Not authorised: ${reason}`)
    this.name = 'NotAuthorizedError'
  }
}

/** Throws unless the caller has unlocked. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const result = await checkAdmin()
  if (!result.ok) throw new NotAuthorizedError(result.reason)
  return result.identity
}

/**
 * Machine authorisation for scheduled jobs.
 * Separate secret from the passcode, so a scheduler token cannot open the UI.
 */
export function checkCronSecret(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = (header ?? '').replace(/^Bearer\s+/i, '')
  return timingSafeEqual(provided, secret)
}

export function adminDeniedMessage(reason: string): string {
  switch (reason) {
    case 'no_passcode_set':
      return 'ADMIN_PASSCODE is not set, so this tool is closed to everyone. Set it in the environment and reload — it is the only credential there is.'
    default:
      return 'Enter your passcode to unlock.'
  }
}
