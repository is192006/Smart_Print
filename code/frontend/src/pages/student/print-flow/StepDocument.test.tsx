import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { SafeDocument } from '@/types'
import { StepDocument } from './StepDocument'

const mockList = vi.fn()
vi.mock('@/services/documentApi', () => ({
  documentApi: {
    list: () => mockList(),
    upload: vi.fn(),
  },
}))

const DOCS: SafeDocument[] = [
  {
    documentId: 'doc-1',
    fileName: 'Assignment.pdf',
    fileUrl: '/api/documents/doc-1/download',
    fileType: 'PDF',
    mimeType: 'application/pdf',
    fileSize: 10240,
    fileHash: 'a'.repeat(64),
    pageCount: 5,
    uploadedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    documentId: 'doc-2',
    fileName: 'Notes.pdf',
    fileUrl: '/api/documents/doc-2/download',
    fileType: 'PDF',
    mimeType: 'application/pdf',
    fileSize: 20480,
    fileHash: 'b'.repeat(64),
    pageCount: 12,
    uploadedAt: '2026-01-01T00:00:00.000Z',
  },
]

function setup(selectedDocuments: SafeDocument[] = []) {
  mockList.mockResolvedValue(DOCS)
  const onAdd = vi.fn()
  const onRemove = vi.fn()
  const onContinue = vi.fn()
  render(
    <StepDocument selectedDocuments={selectedDocuments} onAdd={onAdd} onRemove={onRemove} onContinue={onContinue} />,
  )
  return { onAdd, onRemove, onContinue }
}

describe('StepDocument - multi-document selection', () => {
  it('lets the student select a single document', async () => {
    const { onAdd } = setup([])
    await waitFor(() => expect(screen.getByText('Assignment.pdf')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Assignment.pdf'))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(DOCS[0])
  })

  it('lets the student select multiple documents one after another', async () => {
    const { onAdd } = setup([])

    await waitFor(() => expect(screen.getByText('Assignment.pdf')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Assignment.pdf'))
    await userEvent.click(screen.getByText('Notes.pdf'))

    expect(onAdd).toHaveBeenNthCalledWith(1, DOCS[0])
    expect(onAdd).toHaveBeenNthCalledWith(2, DOCS[1])
  })

  it('shows already-selected documents in a "Selected documents" summary with a remove control', async () => {
    const { onRemove } = setup([DOCS[0]])
    await waitFor(() => expect(screen.getByText('Selected documents (1)')).toBeInTheDocument())

    // The already-selected document must not appear again in the pickable list.
    expect(screen.queryByText('Or choose an existing document')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /remove assignment\.pdf/i }))
    expect(onRemove).toHaveBeenCalledWith('doc-1')
  })

  it('excludes an already-selected document from the pickable list (cannot add it twice)', async () => {
    setup([DOCS[0]])
    await waitFor(() => expect(screen.getByText('Selected documents (1)')).toBeInTheDocument())

    // Notes.pdf (not yet selected) should still be pickable...
    expect(screen.getByText('Notes.pdf')).toBeInTheDocument()
    // ...but Assignment.pdf should only appear once, in the selected list.
    expect(screen.getAllByText('Assignment.pdf')).toHaveLength(1)
  })

  it('disables Continue until at least one document is selected, then enables it', async () => {
    setup([])
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    expect(continueBtn).toBeDisabled()
  })

  it('enables Continue once a document is selected', () => {
    setup([DOCS[0]])
    const continueBtn = screen.getByRole('button', { name: /continue with 1 document/i })
    expect(continueBtn).toBeEnabled()
  })
})
