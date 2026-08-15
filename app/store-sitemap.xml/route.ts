import { absoluteUrl, storeUrl } from '@/lib/commerce/brand'
import { listProducts } from '@/lib/commerce/db/repo'
import { isSellable } from '@/lib/commerce/research/scoring'

export const runtime = 'nodejs'
// Generated per request. Prerendering it made `next build` depend on the
// database being reachable, which is the wrong coupling for a file whose whole
// purpose is to reflect the live catalogue.
export const dynamic = 'force-dynamic'

/**
 * GET /store-sitemap.xml — generated from live catalogue data.
 * Named `store-sitemap` rather than `sitemap` so it does not collide with any
 * sitemap the existing PropGuard app may add later.
 */
export async function GET(): Promise<Response> {
  const products = (await listProducts({ published: true })).filter((p) => isSellable(p.status))

  const staticPaths = [
    { path: storeUrl('/'), priority: '1.0', changefreq: 'weekly' },
    { path: storeUrl('/shop'), priority: '0.9', changefreq: 'daily' },
    { path: storeUrl('/pages/about'), priority: '0.5', changefreq: 'monthly' },
    { path: storeUrl('/pages/faq'), priority: '0.6', changefreq: 'monthly' },
    { path: storeUrl('/contact'), priority: '0.4', changefreq: 'yearly' },
    { path: storeUrl('/pages/shipping'), priority: '0.4', changefreq: 'yearly' },
    { path: storeUrl('/pages/returns'), priority: '0.4', changefreq: 'yearly' },
    { path: storeUrl('/pages/privacy'), priority: '0.2', changefreq: 'yearly' },
    { path: storeUrl('/pages/terms'), priority: '0.2', changefreq: 'yearly' },
  ]

  const urls = [
    ...staticPaths.map(
      (p) =>
        `<url><loc>${absoluteUrl(p.path)}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
    ),
    ...products.map(
      (p) =>
        `<url><loc>${absoluteUrl(storeUrl(`/product/${p.slug}`))}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
    ),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  })
}
