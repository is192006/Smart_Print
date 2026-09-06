import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { queueApi } from '@/services/queueApi'
import type { SafeOrder, SafeQueueEntry } from '@/types'

interface StepQueueProps {
  order: SafeOrder
}

export function StepQueue({ order }: StepQueueProps) {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<SafeQueueEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    queueApi
      .getForOrder(order.orderId)
      .then((entry) => {
        if (!cancelled) setQueue(entry)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [order.orderId])

  const isFree = Number(order.totalAmount) === 0
  const documentSummary =
    order.items.length === 1
      ? order.items[0]?.fileName ?? 'Your document'
      : `${order.items.length} documents`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '20px 0 8px', textAlign: 'center' }}>
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--color-success-soft)',
          color: 'var(--color-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="checkCircle" size={30} />
      </span>

      <div>
        <p style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>You're in the queue</p>
        {isFree && (
          <p className="text-muted" style={{ fontSize: 13.5 }}>Faculty printing — payment not required.</p>
        )}
      </div>

      <Card padded style={{ width: '100%', maxWidth: 380 }}>
        {!queue ? (
          <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
            <Spinner size={22} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-around', paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <p className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Token</p>
                <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 28, fontWeight: 800 }}>#{queue.queueNumber}</p>
              </div>
              {queue.position !== null && (
                <div>
                  <p className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Position</p>
                  <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 28, fontWeight: 800 }}>#{queue.position}</p>
                </div>
              )}
            </div>
            <p style={{ fontWeight: 700, fontSize: 14.5 }}>{order.shopName}</p>
            <p className="text-secondary" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {documentSummary}
            </p>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Status: Waiting
            </p>
          </>
        )}
      </Card>

      <p className="text-muted" style={{ fontSize: 13, maxWidth: 340 }}>
        Keep this screen handy when you collect your prints.
      </p>

      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 380 }}>
        <Button block variant="secondary" onClick={() => navigate('/dashboard')}>
          Back to Home
        </Button>
        <Button block onClick={() => navigate(`/orders/${order.orderId}`)}>
          Track Order
        </Button>
      </div>
    </div>
  )
}
