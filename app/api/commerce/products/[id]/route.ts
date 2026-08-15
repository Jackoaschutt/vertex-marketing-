import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { fail, handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator, slugify } from '@/lib/commerce/validate'
import {
  deleteProduct,
  getProductDetail,
  getProductRow,
  logEvent,
  updateProduct,
  listSalesForProduct,
} from '@/lib/commerce/db/repo'
import {
  canTransition,
  computeComponents,
  isSellable,
  totalScore,
  EMPTY_INPUT,
} from '@/lib/commerce/research/scoring'
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

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const detail = await getProductDetail(id)
    if (!detail) return fail(404, 'Product not found.')
    return ok(detail)
  } catch (err) {
    return handleError(err, 'products:get')
  }
}

/**
 * PATCH /api/commerce/products/[id] — admin.
 *
 * Enforces two invariants that protect the storefront:
 *   - status changes must follow the lifecycle machine
 *   - a product can only be published from a sellable status
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const current = await getProductRow(id)
    if (!current) return fail(404, 'Product not found.')

    const body = await readJson(request)
    const v = new Validator(body)
    const patch: Record<string, unknown> = {}

    const raw = body as Record<string, unknown>
    if ('name' in raw) patch.name = v.string('name', { required: true, min: 2, max: 120 })
    if ('slug' in raw) patch.slug = slugify(v.string('slug', { required: true, max: 90 }))
    if ('tagline' in raw) patch.tagline = v.string('tagline', { max: 200 }) || null
    if ('category' in raw) patch.category = v.string('category', { max: 60 }) || null
    if ('targetAudience' in raw) patch.target_audience = v.string('targetAudience', { max: 300 }) || null
    if ('problemSolved' in raw) patch.problem_solved = v.string('problemSolved', { max: 600 }) || null
    if ('metaTitle' in raw) patch.meta_title = v.string('metaTitle', { max: 70 }) || null
    if ('metaDescription' in raw) patch.meta_description = v.string('metaDescription', { max: 180 }) || null
    if ('priceCents' in raw) patch.price_cents = v.int('priceCents', { min: 0 })
    if ('costCents' in raw) patch.cost_cents = v.int('costCents', { min: 0 })
    if ('shippingCostCents' in raw) patch.shipping_cost_cents = v.int('shippingCostCents', { min: 0 })
    if ('compareAtCents' in raw) {
      const compare = v.int('compareAtCents', { min: 0 })
      // A compare-at price below the selling price is a fake discount.
      const price = (patch.price_cents as number) ?? current.price_cents
      if (compare > 0 && compare <= price) {
        v.fail('compareAtCents must be greater than the selling price, or 0 to remove it.')
      }
      patch.compare_at_cents = compare > 0 ? compare : null
    }
    if ('shipDaysMin' in raw) patch.ship_days_min = v.int('shipDaysMin', { min: 0, max: 120 })
    if ('shipDaysMax' in raw) patch.ship_days_max = v.int('shipDaysMax', { min: 0, max: 180 })
    if ('featured' in raw) patch.featured = v.bool('featured')
    if ('position' in raw) patch.position = v.int('position', { min: 0, max: 9999 })

    let nextStatus = current.status
    if ('status' in raw) {
      nextStatus = v.oneOf('status', STATUSES, { required: true })
      if (nextStatus !== current.status && !canTransition(current.status, nextStatus)) {
        v.fail(
          `Cannot move a product from "${current.status}" to "${nextStatus}". Allowed: ${STATUSES.filter((s) => canTransition(current.status, s)).join(', ') || 'none'}.`
        )
      }
      patch.status = nextStatus
      if (nextStatus === 'testing' && !current.date_tested) {
        patch.date_tested = new Date().toISOString()
      }
    }

    if ('published' in raw) {
      const published = v.bool('published')
      if (published && !isSellable(nextStatus)) {
        v.fail(
          `A product with status "${nextStatus}" cannot be published. Move it to approved, testing, winner or scaling first.`
        )
      }
      patch.published = published
    }

    if ('research' in raw) {
      const research = v.object('research')
      const input = {
        ...EMPTY_INPUT,
        ...(current.research_inputs as object),
        ...research,
        priceCents: (patch.price_cents as number) ?? current.price_cents,
        costCents: (patch.cost_cents as number) ?? current.cost_cents,
        shippingCostCents: (patch.shipping_cost_cents as number) ?? current.shipping_cost_cents,
        shipDaysMax: (patch.ship_days_max as number) ?? current.ship_days_max,
      }
      const components = computeComponents(input)
      Object.assign(patch, components, {
        product_score: totalScore(components),
        research_inputs: input,
      })
    }

    v.done()

    const product = await updateProduct(id, patch)

    await logEvent({
      kind: 'product.updated',
      message: `${admin.email} updated "${product.name}".`,
      product_id: id,
      data: { fields: Object.keys(patch) },
    })

    return ok({ product })
  } catch (err) {
    return handleError(err, 'products:update')
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const product = await getProductRow(id)
    if (!product) return fail(404, 'Product not found.')
    // Deleting a product cascades to its ledger rows, which would silently
    // rewrite past months' profit. Refuse, and say what to do instead.
    const sales = await listSalesForProduct(id)
    if (sales.length > 0) {
      return fail(
        409,
        `"${product.name}" has ${sales.length} ledger entr(ies) against it. Deleting it would remove that revenue from your books and change months you have already closed. Mark it a loser instead — that keeps the history and the lesson.`
      )
    }
    await deleteProduct(id)
    await logEvent({
      kind: 'product.deleted',
      level: 'warn',
      message: `${admin.email} deleted "${product.name}".`,
    })
    return ok({ deleted: true })
  } catch (err) {
    return handleError(err, 'products:delete')
  }
}
