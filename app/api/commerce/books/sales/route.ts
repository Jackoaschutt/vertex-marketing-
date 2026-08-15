import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { fail, handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { deleteSale, logEvent, upsertSale } from '@/lib/commerce/db/repo'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/books/sales — admin.
 *
 * One day of sales for one product on one channel. Upserted on
 * (day, product, channel), so re-entering a day corrects it rather than
 * double-counting — the single most damaging mistake a hand-kept ledger can
 * make.
 *
 * Zero is a legitimate entry. "No sales that day" is a fact worth recording,
 * and it is what stops the ledger-gap job nagging about a day that genuinely
 * had none.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const day = v.string('day', { required: true, min: 10, max: 10 })
    const productId = v.string('productId', { max: 64 })
    const channel = v.string('channel', { required: true, max: 40 })
    const units = v.int('units', { min: 0 })
    const revenueCents = v.int('revenueCents', { min: 0 })
    const cogsCents = v.int('cogsCents', { min: 0 })
    const shippingCostCents = v.int('shippingCostCents', { min: 0 })
    const feesCents = v.int('feesCents', { min: 0 })
    const refundsCents = v.int('refundsCents', { min: 0 })
    const refundUnits = v.int('refundUnits', { min: 0 })
    const note = v.string('note', { max: 500 })

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) v.fail('day must be in YYYY-MM-DD format.')
    if (day > new Date().toISOString().slice(0, 10)) v.fail('That day is in the future.')
    if (refundsCents > revenueCents) {
      v.fail('Refunds cannot exceed revenue for the same day. Record the refund on the day it was issued.')
    }
    if (refundUnits > units) v.fail('Refunded units cannot exceed units sold on the same day.')
    v.done()

    const sale = await upsertSale({
      day,
      product_id: productId || null,
      channel,
      units,
      revenue_cents: revenueCents,
      cogs_cents: cogsCents,
      shipping_cost_cents: shippingCostCents,
      fees_cents: feesCents,
      refunds_cents: refundsCents,
      refund_units: refundUnits,
      note: note || null,
    })

    await logEvent({
      kind: 'books.sale_recorded',
      message: `${admin.email} recorded ${units} unit(s) on ${channel} for ${day}.`,
      product_id: productId || null,
      data: { day, channel, revenueCents, units },
    })

    return ok({ sale })
  } catch (err) {
    return handleError(err, 'books:sales')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return fail(400, 'id is required.')
    await deleteSale(id)
    await logEvent({
      kind: 'books.sale_deleted',
      level: 'warn',
      message: `${admin.email} deleted a ledger entry.`,
      data: { id },
    })
    return ok({ deleted: id })
  } catch (err) {
    return handleError(err, 'books:sales:delete')
  }
}
