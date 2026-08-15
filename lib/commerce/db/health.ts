/**
 * Database reachability, translated into something an operator can act on.
 *
 * Without this, a misconfigured database produces Next's generic
 * "Application error: a server-side exception has occurred … Digest: 222848690",
 * which tells the person looking at it nothing at all. Diagnosing one of those
 * meant pulling server logs.
 *
 * Postgres and PostgREST failures fall into a small number of shapes, and each
 * one points at a different, specific fix. Naming them is the whole job here.
 */

import { getDriver, TABLES } from './index'

export type HealthStatus = 'ok' | 'unreachable' | 'bad_key' | 'missing_schema' | 'unknown'

export interface DbHealth {
  status: HealthStatus
  /** One line naming what is wrong. */
  title: string
  /** What to actually do about it. */
  fix: string
  /** The underlying error, kept so nothing is hidden from the operator. */
  detail: string | null
}

export const HEALTHY: DbHealth = {
  status: 'ok',
  title: 'Connected',
  fix: '',
  detail: null,
}

export function classify(message: string): Omit<DbHealth, 'detail'> {
  const m = message.toLowerCase()

  // The host did not answer at all: wrong URL, or a paused Supabase project.
  if (m.includes('fetch failed') || m.includes('enotfound') || m.includes('econnrefused')) {
    return {
      status: 'unreachable',
      title: 'The database did not answer',
      fix: 'NEXT_PUBLIC_SUPABASE_URL points at a host that is not responding. The usual cause is a paused Supabase project — free projects pause after a period of inactivity and have to be resumed from the dashboard. Check the URL matches the project you meant, and that the project is not paused.',
    }
  }

  // The host answered and rejected the credential.
  if (m.includes('invalid api key') || m.includes('jwt') || m.includes('unauthorized')) {
    return {
      status: 'bad_key',
      title: 'The database rejected the key',
      fix: 'The host is reachable, so the URL is right — SUPABASE_SERVICE_ROLE_KEY is wrong or belongs to a different project. Keys are per-project and do not transfer. Copy the service_role key from Project Settings → API Keys for this exact project. The anon or publishable key will not work: row-level security blocks it by design.',
    }
  }

  // Connected and authorised, but the tables are not there.
  if (m.includes('does not exist') || m.includes('relation') || m.includes('schema cache')) {
    return {
      status: 'missing_schema',
      title: 'Connected, but the tables are missing',
      fix: 'The credentials work but this database has no ds_ tables. Run both migrations in order: supabase/migrations/011_commerce_core.sql, then 012_research_and_books.sql. If you meant to point at a different project, change the URL and key instead.',
    }
  }

  return {
    status: 'unknown',
    title: 'The database returned an error',
    fix: 'The exact message is below. If it is not obvious, check that the project is running and that the service_role key belongs to it.',
  }
}

/** Pulls every scrap of text out of a driver error, wherever the client hid it. */
function describe(err: unknown): string {
  const parts: string[] = []
  if (err instanceof Error) {
    if (err.message) parts.push(err.message)
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) {
      if (cause.message) parts.push(cause.message)
    } else if (cause && typeof cause === 'object') {
      // PostgREST returns { message, code, hint, details }, and on a HEAD
      // request `message` can be empty while `code` still identifies the fault.
      for (const key of ['message', 'code', 'hint', 'details']) {
        const value = (cause as Record<string, unknown>)[key]
        if (typeof value === 'string' && value) parts.push(value)
      }
    }
  } else {
    parts.push(String(err))
  }
  return parts.join(' · ')
}

/**
 * Cheap probe run once per admin page load.
 *
 * Uses a real select rather than a count: `count` issues a HEAD request, and a
 * HEAD response carries no body, so an authentication failure comes back with
 * an empty message and cannot be told apart from anything else. Reading one row
 * costs the same and returns a message worth showing.
 */
export async function checkDatabase(): Promise<DbHealth> {
  try {
    await getDriver().select(TABLES.settings, { limit: 1 })
    return HEALTHY
  } catch (err) {
    const detail = describe(err)
    return { ...classify(detail), detail: detail || 'No error message was returned.' }
  }
}
