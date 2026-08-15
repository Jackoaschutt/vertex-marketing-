import { NextRequest, NextResponse } from 'next/server'
import {
  isPasscodeConfigured,
  passcodeMatches,
  sessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from '@/lib/commerce/auth'
import { rateLimit } from '@/lib/commerce/http'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/unlock
 *
 * Rate limited hard, because a passcode is a single secret with no account
 * lockout behind it — throttling is the only thing standing between this and
 * an offline-speed guessing attack.
 *
 * The response never distinguishes "wrong passcode" from anything else.
 */
export async function POST(request: NextRequest) {
  if (!isPasscodeConfigured()) {
    return NextResponse.json(
      { error: 'ADMIN_PASSCODE is not set on the server, so nothing can unlock it.' },
      { status: 503 }
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = rateLimit(`unlock:${ip}`, 8, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } }
    )
  }

  let passcode = ''
  try {
    const body = (await request.json()) as { passcode?: unknown }
    passcode = typeof body.passcode === 'string' ? body.passcode : ''
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  if (!passcodeMatches(passcode)) {
    return NextResponse.json({ error: 'That passcode is not right.' }, { status: 401 })
  }

  const token = sessionToken()
  if (!token) {
    return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}

/** DELETE — lock it again. */
export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 0,
  })
  return response
}
