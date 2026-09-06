import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { AuthLayout } from '@/layouts/AuthLayout'
import { homeRouteForRole } from '@/routes/guards'
import { ApiError } from '@/types/api'

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return error.message.toLowerCase().includes('inactive')
        ? 'Your account is inactive. Please contact an administrator.'
        : 'Invalid email or password.'
    }
    if (error.status === 400) {
      return 'Please enter your college email and password.'
    }
    if (error.status === 0) {
      return 'Connection lost. Please check your network and try again.'
    }
  }
  return 'Something went wrong. Please try again.'
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)

    if (!email.trim()) {
      setError('Please enter your college email.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setIsSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from || homeRouteForRole(user.role), { replace: true })
    } catch (err) {
      // Email is preserved on failure so the student doesn't have to retype it.
      setError(loginErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      heading="Welcome back 👋"
      subheading="Sign in to upload, print, and track your orders."
      footer={
        <>
          New to SmartPrint? <Link to="/register">Create student account</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="auth-error-banner" role="alert">
            <Icon name="alert" size={17} />
            <span>{error}</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Email"
            required
            type="email"
            autoComplete="email"
            placeholder="you@thapar.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="field-row">
              <label className="field__label" htmlFor="login-password">
                Password<span className="field__required" aria-hidden="true"> *</span>
              </label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <Input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" block size="lg" isLoading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Login'}
          </Button>
          <p className="auth-required-note">* Required field</p>
        </div>
      </form>
    </AuthLayout>
  )
}
