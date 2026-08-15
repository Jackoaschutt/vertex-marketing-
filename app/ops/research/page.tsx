import { listProducts } from '@/lib/commerce/db/repo'
import { SCORE_WEIGHTS } from '@/lib/commerce/research/scoring'
import { Card, StatusBadge, Table } from '@/components/ops/ui'
import { ResearchConsole } from '@/components/ops/ResearchConsole'

export const dynamic = 'force-dynamic'

export default async function OpsResearch() {
  const pipeline = await listProducts({
    status: ['researching', 'validation', 'approved', 'rejected'],
    sort: 'score',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Research</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-600">
          Score a candidate against the 100-point rubric. Margin and shipping are computed from the
          real numbers; everything else is a judgement call you make explicitly.
        </p>
      </div>

      <ResearchConsole />

      <Card title="Rubric">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(SCORE_WEIGHTS).map(([key, weight]) => (
            <div key={key} className="rounded-xl border border-ink-200 p-3">
              <p className="text-xs uppercase tracking-wider text-ink-500">{key}</p>
              <p className="mt-1 text-lg tabular-nums text-ink-900">0–{weight}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          A hard gate overrides the total: a product with zero margin score, zero risk score, or a
          gross margin under 35% is a <strong>skip</strong> regardless of how well it scores
          elsewhere.
        </p>
      </Card>

      <Card title="Pipeline">
        {pipeline.length === 0 ? (
          <p className="text-sm text-ink-600">No candidates in the pipeline yet.</p>
        ) : (
          <Table head={['Candidate', 'Score', 'Status', 'Discovered']}>
            {pipeline.map((p) => (
              <tr key={p.id}>
                <td className="py-2.5 pr-4">
                  <p className="text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-500">{p.problem_solved ?? 'No problem statement recorded.'}</p>
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-ink-900">{p.product_score}</td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={p.status} />
                </td>
                <td className="py-2.5 pr-4 text-ink-600">{p.date_discovered.slice(0, 10)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Automated demand signals — not connected">
        <p className="text-sm leading-relaxed text-ink-600">
          Search demand, social interest and saturation are entered by hand today. The repository
          already contains a Python MCP server (<code>server.py</code>) with a working SerpAPI
          integration for Google Trends — connecting it would populate those three signals
          automatically. Until then, treat them as your judgement rather than data.
        </p>
      </Card>
    </div>
  )
}
