import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { SafeOrder, SafeOrderItem } from '@/types'
import { StaffOrderDetailsPage } from './StaffOrderDetailsPage'

const mockGetOne = vi.fn()
vi.mock('@/services/orderApi', () => ({
  orderApi: { getOne: (id: string) => mockGetOne(id) },
}))

const mockQueueGetForOrder = vi.fn()
vi.mock('@/services/queueApi', () => ({
  queueApi: { getForOrder: (id: string) => mockQueueGetForOrder(id) },
}))

const mockPaymentGetForOrder = vi.fn()
vi.mock('@/services/paymentApi', () => ({
  paymentApi: { getForOrder: (id: string) => mockPaymentGetForOrder(id) },
}))

const mockRefundGetForOrder = vi.fn()
vi.mock('@/services/refundApi', () => ({
  refundApi: { getForOrder: (id: string) => mockRefundGetForOrder(id) },
}))

vi.mock('@/services/shopQueueApi', () => ({
  shopQueueApi: { startNext: vi.fn(), complete: vi.fn() },
}))

const mockDownload = vi.fn()
const mockView = vi.fn()
vi.mock('@/services/documentApi', () => ({
  documentApi: {
    download: (id: string, fileName: string) => mockDownload(id, fileName),
    view: (id: string) => mockView(id),
  },
}))

const mockShowToast = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

function makeItem(overrides: Partial<SafeOrderItem>): SafeOrderItem {
  return {
    orderDocumentId: `od-${overrides.documentId}`,
    documentId: 'doc-1',
    fileName: 'file.pdf',
    printType: 'BW',
    paperSize: 'A4',
    sides: 'SINGLE',
    copies: 1,
    pageRange: null,
    printPageCount: 5,
    finishingType: null,
    specialInstructions: null,
    pricePerPage: '5',
    finishingPrice: '0',
    lineTotal: '25',
    ...overrides,
  }
}

function makeOrder(items: SafeOrderItem[]): SafeOrder {
  return {
    orderId: 'order-1',
    orderCode: 'SP-TEST-1',
    shopId: 'shop-1',
    shopName: 'G Block Print Shop',
    customerName: 'Jane Doe',
    customerEmail: 'jane@thapar.edu',
    orderStatus: 'READY',
    totalAmount: '25',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cancelledAt: null,
    cancelledReason: null,
    items,
    statusHistory: [
      { status: 'PLACED', changedByUserId: 'u1', changedAt: new Date().toISOString(), notes: null },
    ],
  }
}

function renderPage(orderId = 'order-1') {
  return render(
    <MemoryRouter initialEntries={[`/staff/orders/${orderId}`]}>
      <Routes>
        <Route path="/staff/orders/:orderId" element={<StaffOrderDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQueueGetForOrder.mockRejectedValue(new Error('no queue entry'))
  mockPaymentGetForOrder.mockRejectedValue(new Error('no payment'))
  mockRefundGetForOrder.mockRejectedValue(new Error('no refund'))
})

describe('StaffOrderDetailsPage document view/download', () => {
  it('renders every document in the order, keyed by its real documentId', async () => {
    const order = makeOrder([
      makeItem({ documentId: 'doc-a', fileName: 'assignment.pdf' }),
      makeItem({ documentId: 'doc-b', fileName: 'notes.docx' }),
    ])
    mockGetOne.mockResolvedValue(order)

    renderPage()

    expect(await screen.findByText('assignment.pdf')).toBeInTheDocument()
    expect(screen.getByText('notes.docx')).toBeInTheDocument()
    expect(screen.getByText('Documents (2)')).toBeInTheDocument()
  })

  it('renders a View and Download button for each document', async () => {
    const order = makeOrder([
      makeItem({ documentId: 'doc-a', fileName: 'assignment.pdf' }),
      makeItem({ documentId: 'doc-b', fileName: 'notes.docx' }),
    ])
    mockGetOne.mockResolvedValue(order)

    renderPage()

    await screen.findByText('assignment.pdf')
    expect(screen.getAllByRole('button', { name: /^view$/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^download$/i })).toHaveLength(2)
  })

  it('clicking Download calls documentApi.download with the real documentId, not the orderDocumentId', async () => {
    const order = makeOrder([makeItem({ documentId: 'doc-a', orderDocumentId: 'od-a', fileName: 'assignment.pdf' })])
    mockGetOne.mockResolvedValue(order)
    mockDownload.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderPage()

    await screen.findByText('assignment.pdf')
    await user.click(screen.getByRole('button', { name: /^download$/i }))

    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('doc-a', 'assignment.pdf'))
    expect(mockDownload).not.toHaveBeenCalledWith('od-a', expect.anything())
  })

  it('clicking View calls documentApi.view with the documentId and renders the preview once the blob resolves', async () => {
    const order = makeOrder([makeItem({ documentId: 'doc-a', fileName: 'assignment.pdf' })])
    mockGetOne.mockResolvedValue(order)
    const blob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' })
    mockView.mockResolvedValue(blob)

    const user = userEvent.setup()
    renderPage()

    await screen.findByText('assignment.pdf')
    await user.click(screen.getByRole('button', { name: /^view$/i }))

    await waitFor(() => expect(mockView).toHaveBeenCalledWith('doc-a'))
    await waitFor(() => {
      const obj = document.querySelector('object[type="application/pdf"]')
      expect(obj).toBeTruthy()
      expect(obj?.getAttribute('data')).toMatch(/^blob:/)
    })
  })

  it('shows a fallback message for non-PDF files instead of attempting a blob preview', async () => {
    const order = makeOrder([makeItem({ documentId: 'doc-a', fileName: 'notes.docx' })])
    mockGetOne.mockResolvedValue(order)

    const user = userEvent.setup()
    renderPage()

    await screen.findByText('notes.docx')
    await user.click(screen.getByRole('button', { name: /^view$/i }))

    expect(await screen.findByText('Preview unavailable for this file type.')).toBeInTheDocument()
    expect(mockView).not.toHaveBeenCalled()
  })

  it('shows an error message in the preview modal when the view request fails', async () => {
    const order = makeOrder([makeItem({ documentId: 'doc-a', fileName: 'assignment.pdf' })])
    mockGetOne.mockResolvedValue(order)
    mockView.mockRejectedValue(new Error('403'))

    const user = userEvent.setup()
    renderPage()

    await screen.findByText('assignment.pdf')
    await user.click(screen.getByRole('button', { name: /^view$/i }))

    expect(await screen.findByText('Unable to preview this document.')).toBeInTheDocument()
  })

  it('shows a toast error when download fails, without crashing', async () => {
    const order = makeOrder([makeItem({ documentId: 'doc-a', fileName: 'assignment.pdf' })])
    mockGetOne.mockResolvedValue(order)
    mockDownload.mockRejectedValue(new Error('network error'))

    const user = userEvent.setup()
    renderPage()

    await screen.findByText('assignment.pdf')
    await user.click(screen.getByRole('button', { name: /^download$/i }))

    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Could not download this file.', 'error'))
  })

  it('renders all documents in a multi-document order and binds each row to its own documentId (not the first row for every button)', async () => {
    const order = makeOrder([
      makeItem({ documentId: 'doc-a', orderDocumentId: 'od-a', fileName: 'a.pdf' }),
      makeItem({ documentId: 'doc-b', orderDocumentId: 'od-b', fileName: 'b.pdf' }),
      makeItem({ documentId: 'doc-c', orderDocumentId: 'od-c', fileName: 'c.pdf' }),
    ])
    mockGetOne.mockResolvedValue(order)
    mockDownload.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderPage()

    await screen.findByText('a.pdf')
    expect(screen.getByText('b.pdf')).toBeInTheDocument()
    expect(screen.getByText('c.pdf')).toBeInTheDocument()

    const downloadButtons = screen.getAllByRole('button', { name: /^download$/i })
    expect(downloadButtons).toHaveLength(3)

    await user.click(downloadButtons[1]!)
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('doc-b', 'b.pdf'))

    await user.click(downloadButtons[2]!)
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('doc-c', 'c.pdf'))

    await user.click(downloadButtons[0]!)
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('doc-a', 'a.pdf'))

    expect(mockDownload).toHaveBeenCalledTimes(3)
  })
})
