import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/StateBlock'
import { PageHeader } from '@/layouts/AppShell'
import { useToast } from '@/hooks/useToast'
import { shopApi } from '@/services/shopApi'
import type { SafeShop } from '@/types'
import { ApiError } from '@/types/api'

export function AdminShopsPage() {
  const { showToast } = useToast()
  const [shops, setShops] = useState<SafeShop[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [busyShopId, setBusyShopId] = useState<string | null>(null)

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

  async function toggleField(shop: SafeShop, field: 'isActive' | 'acceptingOrders') {
    setBusyShopId(shop.shopId)
    try {
      const updated = await shopApi.update(shop.shopId, { [field]: !shop[field] })
      setShops((current) => current?.map((s) => (s.shopId === updated.shopId ? updated : s)) ?? null)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update this shop.', 'error')
    } finally {
      setBusyShopId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Shops"
        subtitle="Manage SmartPrint's printing locations."
        action={<Button onClick={() => setIsCreateOpen(true)}>New Shop</Button>}
      />

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : shops === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={90} radius="16px" />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shops.map((shop) => (
            <Card key={shop.shopId} padded>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15.5 }}>{shop.shopName}</div>
                  <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {shop.shopCode} · {shop.location} · {shop.contact}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Badge tone={shop.isActive ? 'success' : 'danger'}>{shop.isActive ? 'Active' : 'Inactive'}</Badge>
                    <Badge tone={shop.acceptingOrders ? 'success' : 'warning'}>
                      {shop.acceptingOrders ? 'Accepting orders' : 'Not accepting orders'}
                    </Badge>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    isLoading={busyShopId === shop.shopId}
                    onClick={() => toggleField(shop, 'isActive')}
                  >
                    {shop.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    isLoading={busyShopId === shop.shopId}
                    onClick={() => toggleField(shop, 'acceptingOrders')}
                  >
                    {shop.acceptingOrders ? 'Pause orders' : 'Resume orders'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateShopModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(shop) => {
          setShops((current) => (current ? [...current, shop] : [shop]))
          setIsCreateOpen(false)
          showToast('Shop created.', 'success')
        }}
      />
    </div>
  )
}

function CreateShopModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: (shop: SafeShop) => void
}) {
  const [shopCode, setShopCode] = useState('')
  const [shopName, setShopName] = useState('')
  const [location, setLocation] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const shop = await shopApi.create({ shopCode, shopName, location, contact })
      setShopCode('')
      setShopName('')
      setLocation('')
      setContact('')
      onCreated(shop)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this shop.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title="New print shop" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <p className="text-danger" style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Shop code" placeholder="e.g. LIBRARY" value={shopCode} onChange={(e) => setShopCode(e.target.value)} />
          <Input label="Shop name" placeholder="e.g. Library Print Desk" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          <Input label="Location" placeholder="e.g. Central Library, Ground Floor" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input label="Contact" placeholder="Phone number" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="modal__actions" style={{ marginTop: 20 }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Create Shop</Button>
        </div>
      </form>
    </Modal>
  )
}
