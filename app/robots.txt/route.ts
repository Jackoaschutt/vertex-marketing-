import { absoluteUrl } from '@/lib/commerce/brand'

export const runtime = 'nodejs'
export const revalidate = 86400

/** GET /robots.txt — keeps admin, API and cart out of the index. */
export function GET(): Response {
  const body = [
    'User-agent: *',
    'Allow: /store',
    'Disallow: /ops',
    'Disallow: /api/',
    'Disallow: /store/cart',
    'Disallow: /store/order/',
    'Disallow: /dashboard',
    'Disallow: /session',
    'Disallow: /journal',
    'Disallow: /analytics',
    'Disallow: /settings',
    'Disallow: /squad',
    '',
    `Sitemap: ${absoluteUrl('/store-sitemap.xml')}`,
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400',
    },
  })
}
