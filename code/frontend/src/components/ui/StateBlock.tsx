import type { ReactNode } from 'react'

import { ApiError } from '@/types/api'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Button } from './Button'

interface StateBlockProps {
  icon?: IconName
  title: string
  description?: string
  action?: ReactNode
  variant?: 'default' | 'error'
}

export function StateBlock({ icon = 'documents', title, description, action, variant = 'default' }: StateBlockProps) {
  return (
    <div className={`state-block ${variant === 'error' ? 'state-block--error' : ''}`}>
      <span className="state-block__icon">
        <Icon name={icon} size={26} />
      </span>
      <p className="state-block__title">{title}</p>
      {description && <p className="state-block__desc">{description}</p>}
      {action && <div className="state-block__actions">{action}</div>}
    </div>
  )
}

// Translates a raw error (network failure, ApiError, or unknown) into a
// human-readable message - never leaks a stack trace or raw backend detail
// beyond the message the backend already chose to surface.
export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Connection lost. Please check your network and try again.'
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.'
    }
    if (error.status === 403) {
      return "You don't have permission to do that."
    }
    if (error.status === 404) {
      return "We couldn't find what you were looking for."
    }
    return error.message || 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  title?: string
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: ErrorStateProps) {
  const isUnauthorized = error instanceof ApiError && error.status === 401
  return (
    <StateBlock
      variant="error"
      icon="alert"
      title={isUnauthorized ? 'Your session has expired' : title}
      description={friendlyErrorMessage(error)}
      action={
        isUnauthorized ? (
          <Button size="sm" onClick={() => (window.location.href = '/login')}>
            Sign in again
          </Button>
        ) : onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  )
}
