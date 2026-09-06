import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { SafeShop } from '@/types'
import { StepShop } from './StepShop'

const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockList = vi.fn()
vi.mock('@/services/shopApi', () => ({
  shopApi: { list: () => mockList() },
}))

const SHOPS: SafeShop[] = [
  {
    shopId: 'shop-gblock',
    shopCode: 'G_BLOCK',
    shopName: 'G Block Print Shop',
    location: 'G Block',
    contact: '9000000000',
    isActive: true,
    acceptingOrders: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    shopId: 'shop-cse',
    shopCode: 'CSE_FACULTY',
    shopName: 'CSE Department Faculty Printer',
    location: 'CSE Department',
    contact: '9000000001',
    isActive: true,
    acceptingOrders: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

function renderStepShop(role: 'STUDENT' | 'FACULTY') {
  mockUseAuth.mockReturnValue({
    user: { userId: '1', name: 'Test', email: 't@t.com', phone: null, role, status: 'ACTIVE', shopId: null },
  })
  mockList.mockResolvedValue(SHOPS)

  const onSelect = vi.fn()
  render(<StepShop selected={null} onSelect={onSelect} onContinue={vi.fn()} onBack={vi.fn()} />)
  return { onSelect }
}

describe('StepShop - faculty-only shop eligibility (UI reflection of backend rules)', () => {
  it('shows the CSE Faculty Printer as "Faculty only" and blocks selection for a STUDENT', async () => {
    const { onSelect } = renderStepShop('STUDENT')

    await waitFor(() => expect(screen.getByText('CSE Department Faculty Printer')).toBeInTheDocument())
    expect(screen.getByText('Faculty only')).toBeInTheDocument()

    await userEvent.click(screen.getByText('CSE Department Faculty Printer'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows the CSE Faculty Printer as available with no payment required for FACULTY', async () => {
    const { onSelect } = renderStepShop('FACULTY')

    await waitFor(() => expect(screen.getByText('CSE Department Faculty Printer')).toBeInTheDocument())
    expect(screen.getByText('Faculty printing')).toBeInTheDocument()
    expect(screen.getByText('No payment required')).toBeInTheDocument()
    expect(screen.queryByText('Faculty only')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('CSE Department Faculty Printer'))
    expect(onSelect).toHaveBeenCalledWith(SHOPS[1])
  })

  it('a normal shop is selectable by both students and faculty', async () => {
    const { onSelect } = renderStepShop('STUDENT')

    await waitFor(() => expect(screen.getByText('G Block Print Shop')).toBeInTheDocument())
    await userEvent.click(screen.getByText('G Block Print Shop'))
    expect(onSelect).toHaveBeenCalledWith(SHOPS[0])
  })
})
