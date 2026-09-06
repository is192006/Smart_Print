import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OrderStatusBadge } from './Badge'

describe('OrderStatusBadge', () => {
  it('renders a human-readable label for a queued order', () => {
    render(<OrderStatusBadge status="QUEUED" />)
    expect(screen.getByText('In queue')).toBeInTheDocument()
  })

  it('renders a human-readable label for a ready order', () => {
    render(<OrderStatusBadge status="READY" />)
    expect(screen.getByText('Ready for pickup')).toBeInTheDocument()
  })

  it('falls back to the raw status string for an unrecognized value', () => {
    render(<OrderStatusBadge status="SOMETHING_NEW" />)
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument()
  })
})
