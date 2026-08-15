import { redirect } from 'next/navigation'

/**
 * The site root is the storefront. Middleware rewrites `/` to `/store` so the
 * URL stays clean; this redirect is the fallback for any request that reaches
 * the route directly.
 */
export default function RootPage() {
  redirect('/store')
}
