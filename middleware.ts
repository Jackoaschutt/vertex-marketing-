import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * This is a private tool. There is no public surface at all — every path
 * requires a session, and /ops additionally requires the email allowlist.
 *
 * The one exception is `/api/commerce/automations/run`, which enforces its own
 * dual gate (an allowlisted admin session OR a CRON_SECRET bearer token). A
 * session-only check here would lock out every scheduler.
 */
function isSchedulerEndpoint(pathname: string): boolean {
  return pathname === '/api/commerce/automations/run'
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // The dashboard is the app.
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/ops'
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  if (isSchedulerEndpoint(pathname)) return supabaseResponse

  // Without an auth backend there is no session to read. Previously this threw
  // inside createServerClient and produced a 500 on every guarded route; fail
  // closed instead. /ops is allowed through so it can render its own
  // "not authorised" explanation rather than a blank error page.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    // Admin commerce APIs answer with JSON, never an HTML login redirect.
    if (pathname.startsWith('/api/commerce/')) {
      return NextResponse.json(
        { error: 'Supabase Auth is not configured, so this endpoint cannot authorise anyone.' },
        { status: 503 }
      )
    }
    if (pathname === '/ops' || pathname.startsWith('/ops/')) return supabaseResponse
    if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
      return supabaseResponse
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/signup')

  if (!user && !isPublic) {
    if (pathname.startsWith('/api/commerce/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Signing in exists to reach the admin. Whether the account is actually
  // allowlisted is decided by lib/commerce/auth.ts, not here.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/ops', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
