import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SkeletonCardList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/StateBlock'
import { PageHeader } from '@/layouts/AppShell'
import { useToast } from '@/hooks/useToast'
import { adminStaffApi } from '@/services/adminStaffApi'
import { authApi } from '@/services/authApi'
import { shopApi } from '@/services/shopApi'
import type { SafeShop, SafeStaffUser } from '@/types'
import { ApiError } from '@/types/api'

export function AdminStaffPage() {
  const { showToast } = useToast()
  const [staff, setStaff] = useState<SafeStaffUser[] | null>(null)
  const [shops, setShops] = useState<SafeShop[]>([])
  const [error, setError] = useState<unknown>(null)
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false)
  const [isCreateFacultyOpen, setIsCreateFacultyOpen] = useState(false)
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [staffList, shopList] = await Promise.all([adminStaffApi.list(), shopApi.list()])
      setStaff(staffList)
      setShops(shopList)
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggleStatus(member: SafeStaffUser) {
    setBusyStaffId(member.userId)
    try {
      const updated = await adminStaffApi.update(member.userId, {
        status: member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      })
      setStaff((current) => current?.map((s) => (s.userId === updated.userId ? updated : s)) ?? null)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update this staff member.', 'error')
    } finally {
      setBusyStaffId(null)
    }
  }

  async function reassignShop(member: SafeStaffUser, shopId: string) {
    setBusyStaffId(member.userId)
    try {
      const updated = await adminStaffApi.update(member.userId, { shopId })
      setStaff((current) => current?.map((s) => (s.userId === updated.userId ? updated : s)) ?? null)
      showToast('Staff reassigned.', 'success')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not reassign this staff member.', 'error')
    } finally {
      setBusyStaffId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Manage shop staff accounts and faculty provisioning."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setIsCreateFacultyOpen(true)}>
              Provision Faculty
            </Button>
            <Button onClick={() => setIsCreateStaffOpen(true)}>New Staff</Button>
          </div>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : staff === null ? (
        <SkeletonCardList count={3} height={90} />
      ) : staff.length === 0 ? (
        <p className="text-muted">No shop staff accounts yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {staff.map((member) => (
            <Card key={member.userId} padded>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{member.name}</div>
                  <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{member.email}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge tone={member.status === 'ACTIVE' ? 'success' : 'danger'}>{member.status}</Badge>
                    <select
                      className="input"
                      style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
                      value={member.shop?.shopId ?? ''}
                      onChange={(e) => e.target.value && reassignShop(member, e.target.value)}
                      disabled={busyStaffId === member.userId}
                    >
                      <option value="" disabled>
                        {member.shop ? member.shop.shopName : 'Unassigned'}
                      </option>
                      {shops.map((shop) => (
                        <option key={shop.shopId} value={shop.shopId}>
                          {shop.shopName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={busyStaffId === member.userId}
                  onClick={() => toggleStatus(member)}
                >
                  {member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateStaffModal
        isOpen={isCreateStaffOpen}
        shops={shops}
        onClose={() => setIsCreateStaffOpen(false)}
        onCreated={(member) => {
          setStaff((current) => (current ? [...current, member] : [member]))
          setIsCreateStaffOpen(false)
          showToast('Staff account created.', 'success')
        }}
      />

      <CreateFacultyModal
        isOpen={isCreateFacultyOpen}
        onClose={() => setIsCreateFacultyOpen(false)}
        onCreated={() => {
          setIsCreateFacultyOpen(false)
          showToast('Faculty account created.', 'success')
        }}
      />
    </div>
  )
}

function CreateStaffModal({
  isOpen,
  shops,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  shops: SafeShop[]
  onClose: () => void
  onCreated: (member: SafeStaffUser) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopId, setShopId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!shopId) {
      setError('Please select a shop to assign.')
      return
    }
    setIsSubmitting(true)
    try {
      const member = await adminStaffApi.create({ name, email, password, shopId })
      setName('')
      setEmail('')
      setPassword('')
      setShopId('')
      onCreated(member)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this staff account.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title="New shop staff account" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <p className="text-danger" style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Temporary password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="field">
            <label className="field__label">Assigned shop</label>
            <select className="input" value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">Select a shop</option>
              {shops.map((shop) => (
                <option key={shop.shopId} value={shop.shopId}>
                  {shop.shopName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal__actions" style={{ marginTop: 20 }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Create Staff</Button>
        </div>
      </form>
    </Modal>
  )
}

function CreateFacultyModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await authApi.createFaculty({ name, email, password })
      setName('')
      setEmail('')
      setPassword('')
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this faculty account.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title="Provision a faculty account" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="modal__body" style={{ marginBottom: 16 }}>
          Faculty accounts are eligible for free printing at the CSE Department Faculty Printer and
          follow normal payment rules everywhere else.
        </p>
        {error && <p className="text-danger" style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Temporary password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="modal__actions" style={{ marginTop: 20 }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Create Faculty Account</Button>
        </div>
      </form>
    </Modal>
  )
}
