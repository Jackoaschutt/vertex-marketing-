import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { logEvent, setChecklistItem } from '@/lib/commerce/db/repo'
import { CHECKLISTS, STAGE_ORDER, type Stage } from '@/lib/commerce/research/checklist'

export const runtime = 'nodejs'

/**
 * POST /api/commerce/learning/checklist — admin.
 *
 * Ticking a stage item. The item must exist in the checklist definition: an
 * arbitrary key would let progress be recorded against a step that was never
 * defined, which would quietly overstate how far a product has been taken.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const productId = v.string('productId', { required: true, max: 64 })
    const stage = v.oneOf('stage', STAGE_ORDER as readonly Stage[], { required: true })
    const itemKey = v.string('itemKey', { required: true, max: 60 })
    const done = v.bool('done')
    const note = v.string('note', { max: 1000 })

    if (!CHECKLISTS[stage].some((i) => i.key === itemKey)) {
      v.fail(`"${itemKey}" is not a step in the ${stage} checklist.`)
    }
    v.done()

    const row = await setChecklistItem({
      product_id: productId,
      stage,
      item_key: itemKey,
      done,
      note: note || null,
      completed_at: done ? new Date().toISOString() : null,
    })

    await logEvent({
      kind: 'checklist.updated',
      message: `${admin.email} ${done ? 'completed' : 'reopened'} ${stage}/${itemKey}.`,
      product_id: productId,
    })

    return ok({ item: row })
  } catch (err) {
    return handleError(err, 'learning:checklist')
  }
}
