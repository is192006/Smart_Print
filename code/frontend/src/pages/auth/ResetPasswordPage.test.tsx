import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/types/api'
import { ResetPasswordPage } from './ResetPasswordPage'

const mockResetPassword = vi.fn()
vi.mock('@/services/authApi', () => ({
  authApi: { resetPassword: (input: unknown) => mockResetPassword(input) },
}))

function renderResetPasswordPage(path = '/reset-password?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillAndSubmit(password: string, confirmPassword: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/new password/i), password)
  await user.type(screen.getByLabelText(/confirm password/i), confirmPassword)
  await user.click(screen.getByRole('button', { name: /reset password/i }))
}

describe('ResetPasswordPage', () => {
  it('reads the token from the URL and renders the reset form', () => {
    renderResetPasswordPage('/reset-password?token=real-token-value')
    expect(screen.getByLabelText(/new password/i)).toBeRequired()
    expect(screen.getByLabelText(/confirm password/i)).toBeRequired()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('shows an invalid-link error immediately when the token is missing from the URL, with a link to request a new one', () => {
    renderResetPasswordPage('/reset-password')
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request a new reset link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('validates password requirements before calling the API', async () => {
    renderResetPasswordPage()
    await fillAndSubmit('short', 'short')
    expect(await screen.findByRole('alert')).toHaveTextContent(/password requirements/i)
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('rejects a password/confirm-password mismatch before calling the API', async () => {
    renderResetPasswordPage()
    await fillAndSubmit('GoodPassword123', 'DifferentPassword456')
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i)
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('shows a loading state and calls the API with the token from the URL on submit', async () => {
    let resolveReset: (value: string) => void = () => {}
    mockResetPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve
      }),
    )
    renderResetPasswordPage('/reset-password?token=my-real-token')

    await fillAndSubmit('GoodPassword123', 'GoodPassword123')

    expect(mockResetPassword).toHaveBeenCalledWith({
      token: 'my-real-token',
      password: 'GoodPassword123',
      confirmPassword: 'GoodPassword123',
    })
    expect(await screen.findByRole('button', { name: /resetting/i })).toBeDisabled()

    resolveReset('Your password has been reset successfully.')
    expect(await screen.findByText(/reset successfully/i)).toBeInTheDocument()
  })

  it('successful reset shows a success message and a working back-to-login link', async () => {
    mockResetPassword.mockResolvedValue('ok')
    renderResetPasswordPage()

    await fillAndSubmit('GoodPassword123', 'GoodPassword123')

    expect(await screen.findByText(/reset successfully/i)).toBeInTheDocument()
    const backToLoginLinks = screen.getAllByRole('link', { name: /back to login/i })
    expect(backToLoginLinks.length).toBeGreaterThan(0)
    for (const link of backToLoginLinks) {
      expect(link).toHaveAttribute('href', '/login')
    }
  })

  it('shows an invalid/expired token error from the API with a link to request a new one', async () => {
    mockResetPassword.mockRejectedValue(new ApiError(401, 'This password reset link is invalid or has expired'))
    renderResetPasswordPage()

    await fillAndSubmit('GoodPassword123', 'GoodPassword123')

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request a new reset link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('shows a generic API failure message and lets the user retry', async () => {
    mockResetPassword.mockRejectedValue(new ApiError(0, 'Connection lost.'))
    renderResetPasswordPage()

    await fillAndSubmit('GoodPassword123', 'GoodPassword123')

    expect(await screen.findByRole('alert')).toHaveTextContent(/connection lost/i)
    // Still on the form, not the invalid-link state - a network error is retryable.
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('back to login link is present before submission', () => {
    renderResetPasswordPage()
    expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login')
  })
})
