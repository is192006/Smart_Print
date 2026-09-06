import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { SkeletonCardList } from '@/components/ui/Skeleton'
import { ErrorState, StateBlock } from '@/components/ui/StateBlock'
import { documentApi } from '@/services/documentApi'
import type { SafeDocument } from '@/types'
import { ApiError } from '@/types/api'

const ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 413) return 'This file is too large to upload.'
    if (error.status === 400) return error.message || 'This file type is not supported.'
  }
  return 'Upload failed. Please try again.'
}

interface StepDocumentProps {
  selectedDocuments: SafeDocument[]
  onAdd: (doc: SafeDocument) => void
  onRemove: (documentId: string) => void
  onContinue: () => void
}

// One order may bundle several documents (see PrintFlowPage/types.ts's
// OrderItemDraft) - this step lets the student build up that set before
// moving on to a shared shop and per-document settings.
export function StepDocument({ selectedDocuments, onAdd, onRemove, onContinue }: StepDocumentProps) {
  const [documents, setDocuments] = useState<SafeDocument[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setError(null)
    try {
      setDocuments(await documentApi.list())
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploadError(null)
    setIsUploading(true)
    try {
      const doc = await documentApi.upload(file)
      setDocuments((current) => (current ? [doc, ...current] : [doc]))
      onAdd(doc)
    } catch (err) {
      setUploadError(uploadErrorMessage(err))
    } finally {
      setIsUploading(false)
    }
  }

  const selectedIds = new Set(selectedDocuments.map((d) => d.documentId))
  const pickable = documents?.filter((d) => !selectedIds.has(d.documentId)) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {selectedDocuments.length > 0 && (
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Selected documents ({selectedDocuments.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedDocuments.map((doc) => (
              <Card key={doc.documentId} padded style={{ borderColor: 'var(--color-primary)', background: 'var(--color-primary-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="documents" size={16} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.fileName}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {doc.pageCount ? `${doc.pageCount} pages · ` : ''}
                      {formatSize(doc.fileSize)}
                    </div>
                  </div>
                  <Icon name="checkCircle" size={19} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  <button
                    type="button"
                    aria-label={`Remove ${doc.fileName} from this order`}
                    onClick={() => onRemove(doc.documentId)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: 4 }}
                  >
                    <Icon name="x" size={17} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <div
          style={{
            border: '2px dashed var(--color-border-strong)',
            borderRadius: 14,
            padding: '28px 20px',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--color-primary)' }}>
            <Icon name="upload" size={26} />
          </div>
          <p style={{ fontWeight: 700, marginBottom: 12, fontSize: 14.5 }}>
            {selectedDocuments.length > 0 ? 'Add another document' : 'Add documents to this order'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} isLoading={isUploading}>
            Choose a file
          </Button>
          {uploadError && (
            <p className="text-danger" style={{ fontSize: 12.5, marginTop: 10, fontWeight: 500 }}>
              {uploadError}
            </p>
          )}
        </div>
      </Card>

      <div>
        <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Or choose an existing document</p>
        {error ? (
          <ErrorState error={error} onRetry={load} />
        ) : pickable === null ? (
          <SkeletonCardList count={2} height={64} />
        ) : pickable.length === 0 ? (
          <StateBlock
            icon="documents"
            title={documents && documents.length > 0 ? 'All documents added' : 'No documents yet'}
            description={
              documents && documents.length > 0
                ? 'Every uploaded document is already part of this order.'
                : 'Upload a document above to get started.'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pickable.map((doc) => (
              <Card key={doc.documentId} interactive padded onClick={() => onAdd(doc)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-surface-sunken)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="documents" size={16} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.fileName}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {doc.pageCount ? `${doc.pageCount} pages · ` : ''}
                      {formatSize(doc.fileSize)}
                    </div>
                  </div>
                  <Icon name="plus" size={17} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Button block size="lg" disabled={selectedDocuments.length === 0} onClick={onContinue}>
        Continue{selectedDocuments.length > 0 ? ` with ${selectedDocuments.length} ${selectedDocuments.length === 1 ? 'document' : 'documents'}` : ''}
      </Button>
    </div>
  )
}
