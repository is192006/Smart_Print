import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { RequireRole, homeRouteForRole } from './guards'

describe('homeRouteForRole', () => {
  it('sends STUDENT and FACULTY to the shared customer dashboard', () => {
    expect(homeRouteForRole('STUDENT')).toBe('/dashboard')
    expect(homeRouteForRole('FACULTY')).toBe('/dashboard')
  })

  it('sends SHOP_STAFF to the staff console and ADMIN to the admin console', () => {
    expect(homeRouteForRole('SHOP_STAFF')).toBe('/staff')
    expect(homeRouteForRole('ADMIN')).toBe('/admin')
  })
})

const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRole(role: string | null) {
  mockUseAuth.mockReturnValue({
    user: role ? { userId: '1', name: 'Test', email: 't@t.com', phone: null, role, status: 'ACTIVE', shopId: null } : null,
    isLoading: false,
  })

  return render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/403" element={<div>Forbidden Page</div>} />
        <Route element={<RequireRole roles={['SHOP_STAFF']} />}>
          <Route path="/staff" element={<div>Staff Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireRole', () => {
  it('renders the route when the user has an allowed role', () => {
    renderWithRole('SHOP_STAFF')
    expect(screen.getByText('Staff Dashboard')).toBeInTheDocument()
  })

  it('redirects a STUDENT away from a staff-only route to the 403 page, never showing it', () => {
    renderWithRole('STUDENT')
    expect(screen.getByText('Forbidden Page')).toBeInTheDocument()
    expect(screen.queryByText('Staff Dashboard')).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated visitor to login', () => {
    renderWithRole(null)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})
