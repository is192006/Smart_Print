import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Card } from '@/components/ui/Card'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { SkeletonCardList } from '@/components/ui/Skeleton'
import { ErrorState, StateBlock } from '@/components/ui/StateBlock'
import { PageHeader } from '@/layouts/AppShell'
import { orderApi } from '@/services/orderApi'
import type { OrderStatus, SafeOrder } from '@/types'
import { formatDate } from '@/utils/date'
import { formatMoney } from '@/utils/money'

type Tab = 'active' | 'completed' | 'cancelled'

const ACTIVE_STATUSES: OrderStatus[] = ['PLACED', 'PAYMENT_CONFIRMED', 'QUEUED', 'PRINTING', 'READY']
const COMPLETED_STATUSES: OrderStatus[] = ['COLLECTED']
const CANCELLED_STATUSES: OrderStatus[] = ['CANCELLED']

const TABS: { key: Tab; label: string; statuses: OrderStatus[] }[] = [
  { key: 'active', label: 'Active', statuses: ACTIVE_STATUSES },
  { key: 'completed', label: 'Completed', statuses: COMPLETED_STATUSES },
  { key: 'cancelled', label: 'Cancelled', statuses: CANCELLED_STATUSES },
]

export function OrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<SafeOrder[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [tab, setTab] = useState<Tab>('active')

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

  const activeTabDef = TABS.find((t) => t.key === tab)!
  const filtered = orders?.filter((o) => activeTabDef.statuses.includes(o.orderStatus)) ?? []

  return (
    <div>
      <PageHeader title="My Orders" subtitle="Track and manage everything you've printed." />

      <div className="segmented" style={{ marginBottom: 22 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`segmented__option ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : orders === null ? (
        <SkeletonCardList count={3} height={92} />
      ) : filtered.length === 0 ? (
        <StateBlock
          icon="orders"
          title={tab === 'active' ? 'Nothing here yet' : `No ${tab} orders`}
          description={tab === 'active' ? 'Your print history will appear here.' : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((order) => (
            <Card key={order.orderId} interactive padded onClick={() => navigate(`/orders/${order.orderId}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{order.orderCode}</div>
                  <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {order.shopName} · {formatDate(order.createdAt)}
                  </div>
                </div>
                <OrderStatusBadge status={order.orderStatus} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-secondary" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.items.map((i) => i.fileName).join(', ')}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, flexShrink: 0, marginLeft: 12 }}>
                  {formatMoney(order.totalAmount)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
