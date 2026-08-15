/**
 * Admin authorisation for /ops and /api/commerce admin routes.
 *
 * Two gates, both required:
 *   1. A valid Supabase session (middleware redirects anonymous users to /login)
 *   2. The session email appears in COMMERCE_ADMIN_EMAILS
 *
 * An empty allowlist denies everyone. That is deliberate: the failure mode of a
 * misconfigured deployment must be "nobody can reach the admin", never
 * "everybody can reach the admin".
 */

import { createClient } from '@/lib/supabase/server'
import { config } from './config'

export interface AdminIdentity {
  email: string
  userId: string
}

export type AdminCheck =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; reason: 'unauthenticated' | 'not_allowed' | 'no_allowlist' | 'no_auth_backend' }

export async function checkAdmin(): Promise<AdminCheck> {
  const allowlist = config.adminEmails
  if (allowlist.length === 0) return { ok: false, reason: 'no_allowlist' }

  // Supabase Auth needs the project URL + anon key. Without them there is no
  // session to read, so admin access cannot be granted.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, reason: 'no_auth_backend' }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) return { ok: false, reason: 'unauthenticated' }
    if (!allowlist.includes(user.email.toLowerCase())) return { ok: false, reason: 'not_allowed' }
    return { ok: true, identity: { email: user.email.toLowerCase(), userId: user.id } }
  } catch {
    return { ok: false, reason: 'unauthenticated' }
  }
}

export class NotAuthorizedError extends Error {
  constructor(readonly reason: AdminCheck extends { ok: false; reason: infer R } ? R : string) {
    super(`Not authorised: ${String(reason)}`)
    this.name = 'NotAuthorizedError'
  }
}

/** Throws unless the caller is an allowlisted admin. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const result = await checkAdmin()
  if (!result.ok) throw new NotAuthorizedError(result.reason)
  return result.identity
}

/**
 * Machine authorisation for scheduled jobs.
 * Uses a constant-time comparison so the secret cannot be recovered by timing.
 */
export function checkCronSecret(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = (header ?? '').replace(/^Bearer\s+/i, '')
  return timingSafeEqual(provided, secret)
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

export function adminDeniedMessage(reason: string): string {
  switch (reason) {
    case 'no_allowlist':
      return 'COMMERCE_ADMIN_EMAILS is not set, so the admin area is closed to everyone. Set it to a comma-separated list of allowed email addresses and sign in with one of them.'
    case 'no_auth_backend':
      return 'Supabase Auth is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY), so there is no session to authorise.'
    case 'not_allowed':
      return 'Your account is signed in but is not on the commerce admin allowlist.'
    default:
      return 'Sign in with an allowlisted account to reach the commerce admin.'
  }
}
