import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/layouts/AppShell'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  STUDENT: 'Student',
  FACULTY: 'Faculty',
  SHOP_STAFF: 'Shop Staff',
  ADMIN: 'Administrator',
}

function Row({ icon, label, value }: { icon: 'profile' | 'documents' | 'shop' | 'checkCircle'; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </span>
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  )
}

export function ProfilePage() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account details." />
      <Card style={{ maxWidth: 480 }}>
        <Row icon="profile" label="Full name" value={user.name} />
        <Row icon="documents" label="College email" value={user.email} />
        <Row icon="shop" label="Phone" value={user.phone ?? 'Not provided'} />
        <Row icon="checkCircle" label="Account type" value={ROLE_LABEL[user.role]} />
        <div style={{ paddingTop: 20 }}>
          <Button variant="danger" onClick={logout}>
            <Icon name="logout" size={16} />
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  )
}
