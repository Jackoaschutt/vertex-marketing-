import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { fail, handleError, ok } from '@/lib/commerce/http'
import { getOrder, logEvent } from '@/lib/commerce/db/repo'
import { processOrder, syncOrderTracking } from '@/lib/commerce/orders/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/commerce/orders/[id]/retry — admin.
 *
 * Re-runs the fulfilment pipeline for one order. Idempotent: supplier groups
 * that already have a live fulfilment are skipped, so this cannot double-order.
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await ctx.params
    const order = await getOrder(id)
    if (!order) return fail(404, 'Order not found.')

    await logEvent({
      kind: 'order.retry',
      message: `${admin.email} retried fulfilment for ${order.order_number}.`,
      order_id: id,
    })

    const result = await processOrder(id)
    const tracking = await syncOrderTracking(id)
    const refreshed = await getOrder(id)

    return ok({
      result,
      tracking,
      order: refreshed,
      // Report the truth: a retry that still fails is not a success.
      succeeded: result.failures.length === 0,
    })
  } catch (err) {
    return handleError(err, 'orders:retry')
  }
}
