import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator, slugify } from '@/lib/commerce/validate'
import { createProduct, listProducts, logEvent } from '@/lib/commerce/db/repo'
import { computeComponents, totalScore, EMPTY_INPUT } from '@/lib/commerce/research/scoring'
import type { ProductStatus } from '@/lib/commerce/types'

export const runtime = 'nodejs'

const STATUSES: ProductStatus[] = [
  'researching',
  'validation',
  'approved',
  'rejected',
  'testing',
  'winner',
  'loser',
  'scaling',
]

/** GET /api/commerce/products — admin. Full catalogue including research rows. */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const status = request.nextUrl.searchParams.get('status') as ProductStatus | null
    const products = await listProducts({
      status: status && STATUSES.includes(status) ? status : undefined,
      sort: 'score',
    })
    return ok({ products })
  } catch (err) {
    return handleError(err, 'products:list')
  }
}

/**
 * POST /api/commerce/products — admin. Creates a product plus its default
 * variant. New products always start unpublished, whatever their score.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const name = v.string('name', { required: true, min: 2, max: 120 })
    const slugInput = v.string('slug', { max: 90 })
    const priceCents = v.int('priceCents', { required: true, min: 0 })
    const costCents = v.int('costCents', { min: 0 })
    const shippingCostCents = v.int('shippingCostCents', { min: 0 })
    const tagline = v.string('tagline', { max: 200 })
    const category = v.string('category', { max: 60 })
    const targetAudience = v.string('targetAudience', { max: 300 })
    const problemSolved = v.string('problemSolved', { max: 600 })
    const supplierUrl = v.string('supplierUrl', { max: 500 })
    const shipDaysMin = v.int('shipDaysMin', { min: 0, max: 120, default: 7 })
    const shipDaysMax = v.int('shipDaysMax', { min: 0, max: 180, default: 14 })
    const status = v.oneOf('status', STATUSES, { default: 'researching' })
    const research = v.object('research')
    v.done()

    const input = { ...EMPTY_INPUT, ...research, priceCents, costCents, shippingCostCents, shipDaysMax }
    const components = computeComponents(input)

    const product = await createProduct({
      slug: slugify(slugInput || name),
      name,
      tagline: tagline || null,
      category: category || null,
      target_audience: targetAudience || null,
      problem_solved: problemSolved || null,
      supplier_url: supplierUrl || null,
      price_cents: priceCents,
      cost_cents: costCents,
      shipping_cost_cents: shippingCostCents,
      ship_days_min: shipDaysMin,
      ship_days_max: shipDaysMax,
      ...components,
      product_score: totalScore(components),
      research_inputs: input as unknown as Record<string, unknown>,
      status,
      date_discovered: new Date().toISOString(),
    })

    await logEvent({
      kind: 'product.created',
      message: `${admin.email} created "${name}" (score ${product.product_score}/100).`,
      product_id: product.id,
    })

    return ok({ product }, { status: 201 })
  } catch (err) {
    return handleError(err, 'products:create')
  }
}
