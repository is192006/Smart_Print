import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Button } from './Button'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  isOpen: boolean
  maxWidth?: number
}

export function Modal({ title, children, onClose, isOpen, maxWidth }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="modal-overlay"
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={maxWidth ? { maxWidth } : undefined}
      >
        <h2 className="modal__title" id="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel}>
      <p className="modal__body">{description}</p>
      <div className="modal__actions">
        <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
