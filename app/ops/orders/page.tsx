import { config } from '@/lib/commerce/config'
import { formatMoney } from '@/lib/commerce/money'
import {
  listAllFulfillments,
  listOrderItemsForOrders,
  listOrders,
} from '@/lib/commerce/db/repo'
import { ActionButton } from '@/components/ops/ActionButton'
import { Badge, Card, Empty, Note, StatusBadge, Table } from '@/components/ops/ui'

export const dynamic = 'force-dynamic'

export default async function OpsOrders() {
  const orders = await listOrders({ limit: 100 })
  const items = await listOrderItemsForOrders(orders.map((o) => o.id))
  const fulfillments = await listAllFulfillments(300)
  const currency = config.currency

  const attention = orders.filter((o) => o.status === 'needs_attention')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="commerce-display text-2xl text-ink-900">Orders</h1>
        <p className="mt-1 text-sm text-ink-600">
          {orders.length} most recent · {attention.length} need attention
        </p>
      </div>

      {attention.length > 0 && (
        <Note tone="warning">
          Orders in <strong>needs attention</strong> were paid but not fulfilled. Each carries the
          exact reason below. Retry is idempotent — supplier groups that already have a live
          fulfilment are skipped, so it cannot double-order.
        </Note>
      )}

      {orders.length === 0 ? (
        <Empty
          title="No orders yet"
          body="Orders appear here the moment a Stripe checkout completes and the webhook fires."
        />
      ) : (
        <Card>
          <Table head={['Order', 'Customer', 'Items', 'Total', 'Status', 'Fulfilment', 'Actions']}>
            {orders.map((order) => {
              const orderItems = items.filter((i) => i.order_id === order.id)
              const orderFulfillments = fulfillments.filter((f) => f.order_id === order.id)
              return (
                <tr key={order.id} className="align-top">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink-900">{order.order_number}</p>
                    <p className="text-xs text-ink-500">{order.placed_at.slice(0, 16).replace('T', ' ')}</p>
                    {order.attribution?.source && (
                      <p className="mt-1 text-xs text-ink-500">via {order.attribution.source}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-ink-900">{order.email}</p>
                    <p className="text-xs text-ink-500">
                      {order.shipping_address?.city ?? '—'}, {order.shipping_address?.country ?? '—'}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-ink-700">
                    {orderItems.map((i) => (
                      <p key={i.id} className="text-xs">
                        {i.title} × {i.quantity}
                      </p>
                    ))}
                  </td>
                  <td className="py-3 pr-4">
                    <p className="tabular-nums text-ink-900">{formatMoney(order.total_cents, currency)}</p>
                    <p className="text-xs text-ink-500">
                      cogs {formatMoney(order.cogs_cents, currency)} · fee{' '}
                      {formatMoney(order.payment_fee_cents, currency)}
                    </p>
                    {order.refund_cents > 0 && (
                      <p className="text-xs text-clay-600">
                        refunded {formatMoney(order.refund_cents, currency)}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={order.status} />
                    {order.attention_reason && (
                      <p className="mt-1.5 max-w-[18rem] text-xs leading-relaxed text-clay-600">
                        {order.attention_reason}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {orderFulfillments.length === 0 ? (
                      <span className="text-xs text-ink-500">none</span>
                    ) : (
                      orderFulfillments.map((f) => (
                        <div key={f.id} className="mb-1.5">
                          <Badge tone={f.status === 'failed' ? 'critical' : 'info'}>{f.status}</Badge>
                          {f.tracking_number && (
                            <p className="mt-0.5 text-xs text-ink-600">{f.tracking_number}</p>
                          )}
                          {f.error_message && (
                            <p className="mt-0.5 max-w-[16rem] text-xs text-clay-600">{f.error_message}</p>
                          )}
                        </div>
                      ))
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <ActionButton
                      url={`/api/commerce/orders/${order.id}/retry`}
                      label="Retry fulfilment"
                      busyLabel="Retrying…"
                      resultKind="order-retry"
                    />
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>
      )}
    </div>
  )
}
