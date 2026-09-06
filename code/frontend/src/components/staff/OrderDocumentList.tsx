import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'
import { documentApi } from '@/services/documentApi'
import type { SafeOrderItem } from '@/types'
import { formatMoney } from '@/utils/money'

// Only PDFs are known to render reliably in a browser's built-in viewer -
// everything else (Office formats, images that aren't natively displayable
// inline the same way) falls back to "Preview unavailable" + Download,
// rather than pretending every format can be previewed.
function isPreviewable(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf')
}

interface PreviewState {
  item: SafeOrderItem
  status: 'loading' | 'ready' | 'error' | 'unsupported'
  objectUrl: string | null
}

// Shared View/Download implementation for an order's documents - reused by
// StaffOrderDetailsPage and StaffDashboardPage's "Currently printing" card
// so both go through the exact same authenticated documentApi.view/download
// calls (which carry the server-enforced shop-isolation) rather than
// duplicating the fetch/preview/cleanup logic per page.
export function OrderDocumentList({ items, showPrice = true }: { items: SafeOrderItem[]; showPrice?: boolean }) {
  const { showToast } = useToast()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)

  // The object URL is only ever held by this preview state - always revoked
  // when the preview changes or closes so blobs never leak.
  useEffect(() => {
    return () => {
      if (preview?.objectUrl) URL.revokeObjectURL(preview.objectUrl)
    }
  }, [preview])

  async function handleDownload(item: SafeOrderItem) {
    setDownloadingId(item.documentId)
    try {
      await documentApi.download(item.documentId, item.fileName)
    } catch {
      showToast('Could not download this file.', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  async function openPreview(item: SafeOrderItem) {
    if (!isPreviewable(item.fileName)) {
      setPreview({ item, status: 'unsupported', objectUrl: null })
      return
    }
    setPreview({ item, status: 'loading', objectUrl: null })
    try {
      const blob = await documentApi.view(item.documentId)
      const objectUrl = URL.createObjectURL(blob)
      setPreview({ item, status: 'ready', objectUrl })
    } catch {
      setPreview({ item, status: 'error', objectUrl: null })
      showToast('Could not open this file.', 'error')
    }
  }

  function closePreview() {
    if (preview?.objectUrl) URL.revokeObjectURL(preview.objectUrl)
    setPreview(null)
  }

  return (
    <>
      {items.map((item) => (
        <div key={item.orderDocumentId} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Icon name="documents" size={16} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.fileName}</span>
            </span>
            {showPrice && <span style={{ flexShrink: 0 }}>{formatMoney(item.lineTotal)}</span>}
          </div>
          <p className="text-muted" style={{ fontSize: 12.5 }}>
            {item.printType === 'BW' ? 'B&W' : 'Color'} · {item.paperSize} · {item.sides === 'SINGLE' ? 'Single-sided' : 'Double-sided'} ·{' '}
            {item.copies} {item.copies === 1 ? 'copy' : 'copies'} · {item.printPageCount} pages
            {item.pageRange ? ` · pages ${item.pageRange}` : ''}
            {item.finishingType && item.finishingType !== 'NONE' ? ` · ${item.finishingType.replace('_', ' ').toLowerCase()}` : ''}
          </p>
          {item.specialInstructions && (
            <p className="text-muted" style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
              “{item.specialInstructions}”
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button size="sm" variant="secondary" onClick={() => void openPreview(item)}>
              <Icon name="eye" size={14} />
              View
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleDownload(item)}
              isLoading={downloadingId === item.documentId}
            >
              <Icon name="download" size={14} />
              Download
            </Button>
          </div>
        </div>
      ))}

      <Modal isOpen={!!preview} title={preview?.item.fileName ?? 'Document'} onClose={closePreview} maxWidth={720}>
        {preview?.status === 'loading' && (
          <p className="text-secondary" style={{ padding: '24px 0', textAlign: 'center' }}>
            Loading document...
          </p>
        )}
        {preview?.status === 'ready' && preview.objectUrl && (
          <object
            data={preview.objectUrl}
            type="application/pdf"
            width="100%"
            height="600"
            style={{ borderRadius: 10, border: '1px solid var(--color-border)' }}
          >
            <p className="text-secondary" style={{ padding: '24px 0', textAlign: 'center' }}>
              Unable to preview this document.
            </p>
          </object>
        )}
        {preview?.status === 'error' && (
          <p className="text-secondary" style={{ padding: '24px 0', textAlign: 'center' }}>
            Unable to preview this document.
          </p>
        )}
        {preview?.status === 'unsupported' && (
          <p className="text-secondary" style={{ padding: '24px 0', textAlign: 'center' }}>
            Preview unavailable for this file type.
          </p>
        )}
        <div className="modal__actions">
          {preview?.status !== 'loading' && preview && (
            <Button variant="secondary" onClick={() => void handleDownload(preview.item)}>
              <Icon name="download" size={15} />
              Download
            </Button>
          )}
          {preview?.status === 'ready' && preview.objectUrl && (
            <Button variant="secondary" onClick={() => window.open(preview.objectUrl!, '_blank', 'noopener')}>
              Open in new tab
            </Button>
          )}
          <Button onClick={closePreview}>Close</Button>
        </div>
      </Modal>
    </>
  )
}
