import type { ReactNode } from 'react'

type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info'

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  dot?: boolean
}

export function Badge({ tone = 'neutral', children, dot }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}

const ORDER_STATUS_TONE: Record<string, Tone> = {
  PLACED: 'neutral',
  PAYMENT_CONFIRMED: 'info',
  QUEUED: 'primary',
  PRINTING: 'warning',
  READY: 'success',
  COLLECTED: 'success',
  CANCELLED: 'danger',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PLACED: 'Placed',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  QUEUED: 'In queue',
  PRINTING: 'Printing',
  READY: 'Ready for pickup',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status] ?? 'neutral'} dot>
      {ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  PENDING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
}

const REFUND_STATUS_TONE: Record<string, Tone> = {
  REQUESTED: 'warning',
  PROCESSED: 'success',
  FAILED: 'danger',
}

export function RefundStatusBadge({ status }: { status: string }) {
  return <Badge tone={REFUND_STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
}
