import { NextResponse, type NextRequest } from 'next/server'

/**
 * One gate, one secret.
 *
 * Every path requires an unlocked session except the unlock page itself and the
 * endpoint that sets the cookie. `/api/commerce/automations/run` is also let
 * through because it enforces its own dual gate (unlocked session OR a
 * CRON_SECRET bearer token) — a cookie check here would lock out every
 * scheduler.
 *
 * The token is recomputed from ADMIN_PASSCODE on each request rather than read
 * from a session store, so rotating the passcode logs every device out.
 *
 * This runs on the Edge runtime, so the HMAC uses Web Crypto rather than
 * node:crypto. lib/commerce/auth.ts computes the identical value with the Node
 * API for server components — the two must stay in step, which is what the
 * shared message string and algorithm below are pinned for.
 */
const SESSION_COOKIE = 'ops_session'
const SESSION_MESSAGE = 'ops-session-v1'

async function expectedToken(passcode: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(SESSION_MESSAGE))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

function isOpen(pathname: string): boolean {
  return (
    pathname === '/unlock' ||
    pathname === '/api/commerce/unlock' ||
    pathname === '/api/commerce/automations/run'
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isOpen(pathname)) return NextResponse.next({ request })

  const passcode = process.env.ADMIN_PASSCODE
  const configured = typeof passcode === 'string' && passcode.trim().length > 0

  let unlocked = false
  if (configured) {
    const presented = request.cookies.get(SESSION_COOKIE)?.value ?? ''
    if (presented) {
      unlocked = timingSafeEqual(presented, await expectedToken(passcode))
    }
  }

  if (!unlocked) {
    // APIs answer with JSON; a redirect would be parsed as a broken response by
    // anything calling them.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: configured
            ? 'Locked. Unlock the tool in a browser first.'
            : 'ADMIN_PASSCODE is not set on the server.',
        },
        { status: configured ? 401 : 503 }
      )
    }
    return NextResponse.redirect(new URL('/unlock', request.url))
  }

  // The dashboard is the app.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/ops', request.url))
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
