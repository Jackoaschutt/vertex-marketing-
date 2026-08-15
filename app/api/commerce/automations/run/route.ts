import { NextRequest } from 'next/server'
import { checkAdmin, checkCronSecret } from '@/lib/commerce/auth'
import { fail, handleError, ok } from '@/lib/commerce/http'
import { runAutomations } from '@/lib/commerce/automation/jobs'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/commerce/automations/run?which=daily|weekly|all
 *
 * Two accepted callers:
 *   - an allowlisted admin session (the "Run now" button in /ops/automations)
 *   - a scheduler presenting `Authorization: Bearer $CRON_SECRET`
 *
 * Keeping it scheduler-agnostic means Vercel Cron, GitHub Actions or any
 * external cron works without a code change.
 */
export async function POST(request: NextRequest) {
  try {
    const viaCron = checkCronSecret(request.headers.get('authorization'))
    if (!viaCron) {
      const admin = await checkAdmin()
      if (!admin.ok) {
        return fail(
          403,
          'Automations require an allowlisted admin session or a valid CRON_SECRET bearer token.'
        )
      }
    }

    const whichParam = request.nextUrl.searchParams.get('which')
    const which = whichParam === 'weekly' ? 'weekly' : whichParam === 'all' ? 'all' : 'daily'

    const run = await runAutomations(which)
    return ok({ ...run, triggeredBy: viaCron ? 'cron' : 'admin' })
  } catch (err) {
    return handleError(err, 'automations:run')
  }
}
