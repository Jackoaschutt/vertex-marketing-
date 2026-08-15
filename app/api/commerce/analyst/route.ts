import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { clientKey, handleError, ok, rateLimit, readJson, tooManyRequests } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { ask } from '@/lib/commerce/ai/analyst'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/commerce/analyst — admin.
 * Answers a question about the business from database-derived metrics only.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const limit = rateLimit(clientKey(request, 'analyst'), 20, 60_000)
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds)

    const body = await readJson(request)
    const v = new Validator(body)
    const question = v.string('question', { required: true, min: 3, max: 500 })
    v.done()

    return ok(await ask(question))
  } catch (err) {
    return handleError(err, 'analyst')
  }
}
