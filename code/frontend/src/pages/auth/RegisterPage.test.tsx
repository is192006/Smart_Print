import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/types/api'
import { RegisterPage } from './RegisterPage'

const mockRegister = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ login: vi.fn(), register: mockRegister, logout: vi.fn(), user: null, isLoading: false }),
}))

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RegisterPage', () => {
  it('marks required fields but not the optional phone field', () => {
    renderRegisterPage()
    expect(screen.getByLabelText(/full name/i)).toBeRequired()
    expect(screen.getByLabelText(/thapar email/i)).toBeRequired()
    expect(screen.getByLabelText(/^password/i)).toBeRequired()
    expect(screen.getByLabelText(/confirm password/i)).toBeRequired()
    expect(screen.getByLabelText(/^phone/i)).not.toBeRequired()
    expect(screen.getByText('* Required field')).toBeInTheDocument()
  })

  it('only submits fields that exist on the public registration API (never a role)', async () => {
    mockRegister.mockResolvedValue({ role: 'STUDENT' })
    const user = userEvent.setup()
    renderRegisterPage()

    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/thapar email/i), 'jane@thapar.edu')
    await user.type(screen.getByLabelText(/^password/i), 'password1')
    await user.type(screen.getByLabelText(/confirm password/i), 'password1')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(mockRegister).toHaveBeenCalled())
    const submitted = mockRegister.mock.calls[0][0]
    expect(submitted).toEqual({
      name: 'Jane Doe',
      email: 'jane@thapar.edu',
      phone: undefined,
      password: 'password1',
    })
    expect(submitted).not.toHaveProperty('role')
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
  })

  it('shows a duplicate-email error from the backend', async () => {
    mockRegister.mockRejectedValue(new ApiError(409, 'An account with this email already exists'))
    const user = userEvent.setup()
    renderRegisterPage()

    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/thapar email/i), 'jane@thapar.edu')
    await user.type(screen.getByLabelText(/^password/i), 'password1')
    await user.type(screen.getByLabelText(/confirm password/i), 'password1')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i)
  })

  it('blocks submission when passwords do not match', async () => {
    const user = userEvent.setup()
    renderRegisterPage()

    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/thapar email/i), 'jane@thapar.edu')
    await user.type(screen.getByLabelText(/^password/i), 'password1')
    await user.type(screen.getByLabelText(/confirm password/i), 'password2')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i)
    expect(mockRegister).not.toHaveBeenCalled()
  })
})
