import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { fail, handleError, ok, readJson } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { createNote, deleteNote, logEvent, updateNote } from '@/lib/commerce/db/repo'

export const runtime = 'nodejs'

const KINDS = ['note', 'lesson', 'idea', 'source'] as const

/**
 * POST /api/commerce/learning/notes — admin.
 *
 * The playbook. Deliberately unopinionated about content: this is the owner's
 * own writing, so nothing here validates, rewrites or "improves" it. The only
 * structure imposed is a kind and optional tags, which is what makes it
 * searchable later.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await readJson(request)
    const v = new Validator(body)

    const id = v.string('id', { max: 64 })
    const title = v.string('title', { required: true, max: 200 })
    const noteBody = v.string('body', { max: 20_000 })
    const kind = v.oneOf('kind', KINDS, { required: true })
    const productId = v.string('productId', { max: 64 })
    const tagsRaw = v.string('tags', { max: 300 })
    const pinned = v.bool('pinned')
    v.done()

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12)

    const row = {
      title,
      body: noteBody,
      kind,
      tags,
      product_id: productId || null,
      pinned,
    }

    const note = id ? await updateNote(id, row) : await createNote(row)

    await logEvent({
      kind: id ? 'playbook.note_updated' : 'playbook.note_created',
      message: `${admin.email} ${id ? 'updated' : 'wrote'} "${title}".`,
      product_id: productId || null,
    })

    return ok({ note }, { status: id ? 200 : 201 })
  } catch (err) {
    return handleError(err, 'learning:notes')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return fail(400, 'id is required.')
    await deleteNote(id)
    await logEvent({
      kind: 'playbook.note_deleted',
      level: 'warn',
      message: `${admin.email} deleted a playbook entry.`,
      data: { id },
    })
    return ok({ deleted: id })
  } catch (err) {
    return handleError(err, 'learning:notes:delete')
  }
}
