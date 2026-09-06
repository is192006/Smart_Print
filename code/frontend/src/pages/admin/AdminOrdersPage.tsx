import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/Card'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { SkeletonCardList } from '@/components/ui/Skeleton'
import { ErrorState, StateBlock } from '@/components/ui/StateBlock'
import { PageHeader } from '@/layouts/AppShell'
import { orderApi } from '@/services/orderApi'
import type { OrderStatus, SafeOrder } from '@/types'
import { formatDateTime } from '@/utils/date'
import { formatMoney } from '@/utils/money'

const STATUS_FILTERS: (OrderStatus | 'ALL')[] = [
  'ALL',
  'PLACED',
  'PAYMENT_CONFIRMED',
  'QUEUED',
  'PRINTING',
  'READY',
  'COLLECTED',
  'CANCELLED',
]

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<SafeOrder[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL')

  async function load() {
    setError(null)
    try {
      setOrders(await orderApi.list())
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(
    () => (orders ?? []).filter((o) => filter === 'ALL' || o.orderStatus === filter),
    [orders, filter],
  )

  return (
    <div>
      <PageHeader title="Orders" subtitle="Every order placed across all shops." />

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`segmented__option ${filter === s ? 'is-active' : ''}`}
            style={{ background: filter === s ? 'var(--color-primary-soft)' : 'var(--color-surface-sunken)', color: filter === s ? 'var(--color-primary)' : undefined, flexShrink: 0 }}
            onClick={() => setFilter(s)}
          >
            {s === 'ALL' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : orders === null ? (
        <SkeletonCardList count={4} height={80} />
      ) : filtered.length === 0 ? (
        <StateBlock icon="orders" title="No orders found" description="Try a different filter." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((order) => (
            <Card key={order.orderId} padded>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{order.orderCode}</div>
                  <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {order.shopName} · {formatDateTime(order.createdAt)}
                  </div>
                </div>
                <OrderStatusBadge status={order.orderStatus} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-secondary" style={{ fontSize: 13 }}>
                  {order.items.length} {order.items.length === 1 ? 'document' : 'documents'}
                </span>
                <span style={{ fontWeight: 700 }}>{formatMoney(order.totalAmount)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
