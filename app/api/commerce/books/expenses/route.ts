import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { createExpense, logEvent } from '@/lib/commerce/db/repo'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/books/expenses — admin.
 *
 * Costs that are neither the goods nor the advertising: subscriptions, tools,
 * samples, courses, agency fees. These are what turn an apparently profitable
 * month into a real one, so they are deliberately easy to enter.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const label = v.string('label', { required: true, max: 120 })
    const category = v.oneOf(
      'category',
      ['software', 'samples', 'shipping', 'learning', 'fees', 'contractor', 'other'] as const,
      { required: true }
    )
    const amountCents = v.int('amountCents', { required: true, min: 0 })
    const day = v.string('day', { required: true, min: 10, max: 10 })
    const recurring = v.bool('recurring')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) v.fail('day must be in YYYY-MM-DD format.')
    v.done()

    const expense = await createExpense({
      label,
      category,
      amount_cents: amountCents,
      day,
      recurring,
    })

    await logEvent({
      kind: 'books.expense_recorded',
      message: `${admin.email} recorded "${label}" (${category}).`,
      data: { amountCents, category, day },
    })

    return ok({ expense })
  } catch (err) {
    return handleError(err, 'books:expenses')
  }
}
