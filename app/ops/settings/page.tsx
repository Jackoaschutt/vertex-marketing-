import { brand } from '@/lib/commerce/brand'
import { capabilities, config } from '@/lib/commerce/config'
import { formatMoney } from '@/lib/commerce/money'
import { getSetting } from '@/lib/commerce/db/repo'
import { Badge, Card, Note, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsSettings() {
  const caps = capabilities()
  const [feePercent, feeFixed, targetRoas, lowStock, currency] = await Promise.all([
    getSetting<number>('payment_fee_percent', 2.9),
    getSetting<number>('payment_fee_fixed_cents', 30),
    getSetting<number>('target_roas', 2),
    getSetting<number>('low_stock_threshold', 10),
    getSetting<string>('default_currency', config.currency),
  ])

  const blockers = caps.filter((c) => !c.configured && ['database', 'payments', 'email', 'admin'].includes(c.key))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-600">
          What is live, what is simulated, and exactly what to set to change that.
        </p>
      </div>

      {blockers.length > 0 && (
        <Note tone="warning">
          <strong>Not ready for real money.</strong> {blockers.length} required integration(s) are not
          configured: {blockers.map((b) => b.label).join(', ')}.
        </Note>
      )}

      <Card title="Integration status">
        <div className="space-y-3">
          {caps.map((c) => (
            <div key={c.key} className="rounded-xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={c.configured ? 'REAL' : c.status}>
                  {c.configured ? 'REAL' : c.status}
                </Badge>
                <p className="font-medium text-ink-900">{c.label}</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{c.note}</p>
              {c.requires.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-ink-500">
                  <span>Environment:</span>
                  {c.requires.map((r) => (
                    <code key={r} className="rounded bg-ink-100 px-1">
                      {r}
                    </code>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Operating parameters">
        <Table head={['Setting', 'Value', 'Used for']}>
          <tr>
            <td className="py-2.5 pr-4 text-ink-700">Currency</td>
            <td className="py-2.5 pr-4 text-ink-900">{currency}</td>
            <td className="py-2.5 pr-4 text-ink-600">Display and Stripe checkout</td>
          </tr>
          <tr>
            <td className="py-2.5 pr-4 text-ink-700">Payment fee</td>
            <td className="py-2.5 pr-4 text-ink-900">
              {feePercent}% + {formatMoney(feeFixed, currency)}
            </td>
            <td className="py-2.5 pr-4 text-ink-600">Net profit calculation</td>
          </tr>
          <tr>
            <td className="py-2.5 pr-4 text-ink-700">Target ROAS</td>
            <td className="py-2.5 pr-4 text-ink-900">{targetRoas}</td>
            <td className="py-2.5 pr-4 text-ink-600">Pause / scale recommendations</td>
          </tr>
          <tr>
            <td className="py-2.5 pr-4 text-ink-700">Low stock threshold</td>
            <td className="py-2.5 pr-4 text-ink-900">{lowStock} units</td>
            <td className="py-2.5 pr-4 text-ink-600">Daily inventory job</td>
          </tr>
          <tr>
            <td className="py-2.5 pr-4 text-ink-700">Free delivery over</td>
            <td className="py-2.5 pr-4 text-ink-900">
              {formatMoney(brand.shipping.freeThresholdCents, currency)}
            </td>
            <td className="py-2.5 pr-4 text-ink-600">Cart and checkout</td>
          </tr>
          <tr>
            <td className="py-2.5 pr-4 text-ink-700">Flat delivery rate</td>
            <td className="py-2.5 pr-4 text-ink-900">
              {formatMoney(brand.shipping.flatRateCents, currency)}
            </td>
            <td className="py-2.5 pr-4 text-ink-600">Cart and checkout</td>
          </tr>
        </Table>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Values live in <code>ds_settings</code> (operating parameters) and{' '}
          <code>lib/commerce/brand.ts</code> (brand, voice, shipping and returns policy). Rebranding
          the whole store is editing that one file.
        </p>
      </Card>

      <Card title="Before taking real money">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-600">
          <li>Create a Supabase project and run every migration, including <code>011_commerce_core.sql</code>.</li>
          <li>Set <code>COMMERCE_ADMIN_EMAILS</code> — until then this admin denies everyone.</li>
          <li>Set Stripe live keys and register the <em>commerce</em> webhook separately from the subscription webhook.</li>
          <li>Replace the placeholder policy pages and legal entity details in <code>brand.ts</code>.</li>
          <li>Connect a real supplier and place one live test order end to end.</li>
          <li>Set <code>RESEND_API_KEY</code> so customers actually receive email.</li>
          <li>Confirm the demo-data banner is gone — its presence means no database is connected.</li>
        </ol>
      </Card>
    </div>
  )
}
