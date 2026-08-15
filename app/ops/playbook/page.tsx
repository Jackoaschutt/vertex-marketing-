import { listNotes, listProducts } from '@/lib/commerce/db/repo'
import { NoteEditor } from '@/components/ops/NoteEditor'
import { Badge, Card, Empty, Note as Callout } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

const KIND_TONE: Record<string, string> = {
  lesson: 'positive',
  idea: 'info',
  source: 'info',
  note: 'info',
}

export default async function OpsPlaybook() {
  const [notes, products] = await Promise.all([listNotes(), listProducts({ sort: 'name' })])

  const productName = (id: string | null) =>
    id ? (products.find((p) => p.id === id)?.name ?? null) : null

  const pinned = notes.filter((n) => n.pinned)
  const rest = notes.filter((n) => !n.pinned)
  const lessons = notes.filter((n) => n.kind === 'lesson').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Playbook</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
          What you have worked out, in your own words. A lesson attached to one dead product is
          lost when you stop thinking about that product; a lesson written down here is there for
          the next one.
        </p>
      </div>

      <Card title="Write something down">
        <NoteEditor products={products.map((p) => ({ id: p.id, name: p.name }))} />
      </Card>

      {notes.length === 0 ? (
        <Empty
          title="Nothing written yet"
          body="Start with one thing you got wrong recently and what you would do differently. That single entry is worth more than a course."
        />
      ) : (
        <>
          {lessons === 0 && (
            <Callout>
              You have {notes.length} entr{notes.length === 1 ? 'y' : 'ies'} but none tagged as a
              lesson. Lessons are the ones worth re-reading before the next test — mark them as you
              write them.
            </Callout>
          )}

          {pinned.length > 0 && (
            <Card title="Pinned">
              <div className="space-y-4">
                {pinned.map((n) => (
                  <article key={n.id} className="rounded-xl border border-ink-300 bg-sand-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={KIND_TONE[n.kind]}>{n.kind}</Badge>
                      <h3 className="font-medium text-ink-900">{n.title}</h3>
                      {productName(n.product_id) && (
                        <span className="text-xs text-ink-500">{productName(n.product_id)}</span>
                      )}
                    </div>
                    {n.body && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                        {n.body}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </Card>
          )}

          <Card title={`All entries (${notes.length})`}>
            <div className="space-y-4">
              {rest.map((n) => (
                <article key={n.id} className="rounded-xl border border-ink-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONE[n.kind]}>{n.kind}</Badge>
                    <h3 className="font-medium text-ink-900">{n.title}</h3>
                    {productName(n.product_id) && (
                      <span className="text-xs text-ink-500">{productName(n.product_id)}</span>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-ink-500">
                      {new Date(n.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                      {n.body}
                    </p>
                  )}
                  {n.tags.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {n.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.7rem] text-ink-600"
                        >
                          {t}
                        </span>
                      ))}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
