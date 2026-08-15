import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  parseAttribution,
  serializeAttribution,
} from '@/lib/commerce/analytics/attribution'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Paths middleware must not gate.
 *
 * Storefront pages and the checkout/webhook endpoints are genuinely public.
 * `/api/commerce/automations/run` is listed because it enforces its own dual
 * gate (an allowlisted admin session OR a CRON_SECRET bearer token) — a
 * session-only check here would lock out every scheduler.
 */
function isCommercePublic(pathname: string): boolean {
  return (
    pathname === '/api/commerce/automations/run' ||
    pathname === '/store' ||
    pathname.startsWith('/store/') ||
    pathname.startsWith('/store-media/') ||
    pathname === '/store-sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/api/commerce/cart/validate' ||
    pathname === '/api/commerce/checkout' ||
    pathname === '/api/commerce/contact' ||
    pathname.startsWith('/api/commerce/webhooks/')
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Optional: serve the storefront at the site root. Off by default so
  // PropGuard's landing page is untouched; flip COMMERCE_ROOT=true to switch.
  if (process.env.COMMERCE_ROOT === 'true' && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/store'
    return NextResponse.rewrite(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  // Capture last non-direct click on any storefront landing. First-party
  // cookie, no third-party script, no personal data.
  if (pathname === '/store' || pathname.startsWith('/store/')) {
    const attribution = parseAttribution(request.nextUrl)
    if (attribution) {
      supabaseResponse.cookies.set(ATTRIBUTION_COOKIE, serializeAttribution(attribution), {
        maxAge: ATTRIBUTION_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
      })
    }
  }

  // Storefront and public commerce APIs never touch Supabase Auth — that keeps
  // them fast and lets the store run with no auth backend configured at all.
  if (isCommercePublic(pathname)) return supabaseResponse

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
    if (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname === '/') {
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

  const isPublic = pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/agent-status') ||
    pathname.startsWith('/api/build-status') ||
    pathname === '/'

  if (!user && !isPublic) {
    if (pathname.startsWith('/api/commerce/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
