import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

export function homeRouteForRole(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin'
    case 'SHOP_STAFF':
      return '/staff'
    case 'STUDENT':
    case 'FACULTY':
      return '/dashboard'
  }
}

export function FullPageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )
}

export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}

export function RequireGuest() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <FullPageLoader />
  if (user) return <Navigate to={homeRouteForRole(user.role)} replace />

  return <Outlet />
}

export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  // Frontend routing only hides pages a role shouldn't see - every API call
  // made from within is independently authorized by the backend, which is
  // the only source of truth for what a role may actually do.
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />

  return <Outlet />
}
