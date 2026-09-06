import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/types/api'
import { LoginPage } from './LoginPage'

const mockLogin = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ login: mockLogin, register: vi.fn(), logout: vi.fn(), user: null, isLoading: false }),
}))

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<div>Register Page</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('marks email and password as required and shows the required-field note', () => {
    renderLoginPage()
    expect(screen.getByLabelText(/email/i)).toBeRequired()
    expect(screen.getByLabelText(/^password/i)).toBeRequired()
    expect(screen.getByText('* Required field')).toBeInTheDocument()
  })

  it('auto-focuses the email field', () => {
    renderLoginPage()
    expect(screen.getByLabelText(/email/i)).toHaveFocus()
  })

  it('links to forgot password and register', () => {
    renderLoginPage()
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: /create student account/i })).toHaveAttribute('href', '/register')
  })

  it('toggles password visibility via the accessible eye button', async () => {
    const user = userEvent.setup()
    renderLoginPage()
    const passwordInput = screen.getByLabelText(/^password/i)
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()
  })

  it('submits credentials, disables the button, and shows a loading label', async () => {
    let resolveLogin: (value: { role: string }) => void = () => {}
    mockLogin.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )

    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'student@thapar.edu')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    expect(mockLogin).toHaveBeenCalledWith('student@thapar.edu', 'password123')
    expect(await screen.findByRole('button', { name: /signing in/i })).toBeDisabled()

    resolveLogin({ role: 'STUDENT' })
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
  })

  it('shows an inline error and preserves the entered email on failed login', async () => {
    mockLogin.mockRejectedValue(new ApiError(401, 'Invalid credentials'))
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'student@thapar.edu')
    await user.type(screen.getByLabelText(/^password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /login/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByLabelText(/email/i)).toHaveValue('student@thapar.edu')
  })

  it('shows a validation message and does not call login for empty required fields', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: /login/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter your college email/i)
    expect(mockLogin).not.toHaveBeenCalled()
  })
})
