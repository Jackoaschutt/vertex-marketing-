import { NextRequest } from 'next/server'
import { checkAdmin, checkCronSecret } from '@/lib/commerce/auth'
import { fail, handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { MetaApiError, MetaNotConfiguredError, isMetaConfigured } from '@/lib/commerce/marketing/adapter-meta'
import { importMetaMetrics } from '@/lib/commerce/marketing/import'

export const runtime = 'nodejs'
export const maxDuration = 300

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/commerce/marketing/meta/import
 * Body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }  (defaults to the last 7 days)
 *
 * Accepts an allowlisted admin session or a CRON_SECRET bearer token, so the
 * daily automation and the "Import" button in /ops/marketing share one path.
 *
 * Idempotent: rows are upserted on (product, channel, campaign, day), so
 * re-importing a window corrects it rather than double-counting.
 */
export async function POST(request: NextRequest) {
  try {
    const viaCron = checkCronSecret(request.headers.get('authorization'))
    if (!viaCron) {
      const admin = await checkAdmin()
      if (!admin.ok) {
        return fail(403, 'Importing ad metrics requires an admin session or a valid CRON_SECRET.')
      }
    }

    if (!isMetaConfigured()) {
      return fail(503, 'Meta Ads is not configured, so there is nothing to import.', {
        requires: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
      })
    }

    const body = await readJson(request).catch(() => ({}))
    const v = new Validator(body ?? {})
    const raw = (body ?? {}) as Record<string, unknown>

    const today = new Date()
    const defaultTo = today.toISOString().slice(0, 10)
    const defaultFrom = new Date(today.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)

    const from = 'from' in raw ? v.string('from', { required: true, min: 10, max: 10 }) : defaultFrom
    const to = 'to' in raw ? v.string('to', { required: true, min: 10, max: 10 }) : defaultTo
    if (!DATE.test(from) || !DATE.test(to)) v.fail('from and to must be YYYY-MM-DD dates.')
    if (DATE.test(from) && DATE.test(to) && from > to) v.fail('from must not be after to.')
    v.done()

    try {
      const summary = await importMetaMetrics(from, to)
      return ok({
        ...summary,
        triggeredBy: viaCron ? 'cron' : 'admin',
        note:
          summary.unattributed > 0
            ? 'Some campaigns could not be attributed to a product. They still count toward total ad spend, but not toward any single product P&L. Add a [vsp:<product-slug>] marker to the campaign name, or map it in /ops/marketing.'
            : undefined,
      })
    } catch (err) {
      if (err instanceof MetaApiError) {
        // Meta rejected the request. Report exactly what it said — never
        // return a zeroed summary that reads like a successful import.
        return fail(502, `Meta rejected the request: ${err.message}`, {
          code: err.code,
          subcode: err.subcode,
          hint: err.hint,
        })
      }
      if (err instanceof MetaNotConfiguredError) {
        return fail(503, err.message, { requires: err.requires })
      }
      throw err
    }
  } catch (err) {
    return handleError(err, 'marketing:meta:import')
  }
}
