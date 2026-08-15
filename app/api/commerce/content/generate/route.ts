import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { clientKey, fail, handleError, ok, rateLimit, readJson, tooManyRequests } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { generateContent } from '@/lib/commerce/ai/content'
import { getProductRow, logEvent, saveContent } from '@/lib/commerce/db/repo'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/commerce/content/generate — admin.
 *
 * Generates the full content set for a product. Saves it as an unapproved
 * version so nothing reaches the storefront until a human approves it. The
 * response reports which generator ran (anthropic | fallback) and any
 * guardrail issues that were stripped.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const limit = rateLimit(clientKey(request, 'content'), 12, 60_000)
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds)

    const body = await readJson(request)
    const v = new Validator(body)
    const productId = v.string('productId', { required: true })
    const supplierDescription = v.string('supplierDescription', { max: 4000 })
    const save = v.bool('save', true)
    v.done()

    const product = await getProductRow(productId)
    if (!product) return fail(404, 'Product not found.')

    const result = await generateContent({
      name: product.name,
      category: product.category,
      tagline: product.tagline,
      problemSolved: product.problem_solved,
      targetAudience: product.target_audience,
      supplierDescription: supplierDescription || null,
      priceCents: product.price_cents,
      costCents: product.cost_cents,
      shipDaysMin: product.ship_days_min,
      shipDaysMax: product.ship_days_max,
    })

    if (save) {
      await saveContent({
        product_id: productId,
        version: 1,
        is_ai: result.generator === 'anthropic',
        generator: result.generator,
        model: result.model,
        payload: result.content,
        approved: false,
      })
      await logEvent({
        kind: 'content.generated',
        level: result.issues.length > 0 ? 'warn' : 'info',
        message: `Content generated for "${product.name}" via ${result.generator}${result.issues.length ? ` — ${result.issues.length} guardrail issue(s) stripped` : ''}.`,
        product_id: productId,
        data: { issues: result.issues },
      })
    }

    return ok({
      content: result.content,
      generator: result.generator,
      model: result.model,
      guardrailIssues: result.issues,
      error: result.error,
      saved: save,
    })
  } catch (err) {
    return handleError(err, 'content:generate')
  }
}
