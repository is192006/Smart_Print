import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { SkeletonCardList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/StateBlock'
import { shopApi } from '@/services/shopApi'
import { useAuth } from '@/hooks/useAuth'
import type { SafeShop } from '@/types'

const FACULTY_ONLY_SHOP_CODE = 'CSE_FACULTY'

interface StepShopProps {
  selected: SafeShop | null
  onSelect: (shop: SafeShop) => void
  onContinue: () => void
  onBack: () => void
}

export function StepShop({ selected, onSelect, onContinue, onBack }: StepShopProps) {
  const { user } = useAuth()
  const [shops, setShops] = useState<SafeShop[] | null>(null)
  const [error, setError] = useState<unknown>(null)

  async function load() {
    setError(null)
    try {
      setShops(await shopApi.list())
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (error) return <ErrorState error={error} onRetry={load} />
  if (shops === null) return <SkeletonCardList count={3} height={140} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {shops.map((shop) => {
          const isFacultyOnly = shop.shopCode === FACULTY_ONLY_SHOP_CODE
          const isFreeForMe = isFacultyOnly && user?.role === 'FACULTY'
          const isBlockedForMe = isFacultyOnly && user?.role !== 'FACULTY'
          const isClosed = !shop.isActive || !shop.acceptingOrders
          const disabled = isBlockedForMe || isClosed
          const isSelected = selected?.shopId === shop.shopId

          return (
            <Card
              key={shop.shopId}
              interactive={!disabled}
              padded
              onClick={() => !disabled && onSelect(shop)}
              style={{
                opacity: disabled ? 0.55 : 1,
                cursor: disabled ? 'not-allowed' : undefined,
                borderColor: isSelected ? 'var(--color-primary)' : undefined,
                background: isSelected ? 'var(--color-primary-soft)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{shop.shopName}</div>
                  <div className="text-muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <Icon name="building" size={13} />
                    {shop.location}
                  </div>
                </div>
                {isSelected && <Icon name="checkCircle" size={22} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {isClosed && <Badge tone="danger">Not accepting orders</Badge>}
                {isBlockedForMe && <Badge tone="neutral">Faculty only</Badge>}
                {isFreeForMe && !isClosed && (
                  <>
                    <Badge tone="primary">Faculty printing</Badge>
                    <Badge tone="success">No payment required</Badge>
                  </>
                )}
                {!isFacultyOnly && !isClosed && <Badge tone="success" dot>Accepting orders</Badge>}
              </div>

              {isBlockedForMe && (
                <p className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                  This printer is reserved for faculty accounts.
                </p>
              )}
            </Card>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button block size="lg" disabled={!selected} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  )
}
