const VARIANTS: Record<string, string> = {
  CREATED: 'badge-warning',
  PAYMENT_CONFIRMED: 'badge-warning',
  QUEUED: 'badge',
  PRINTING: 'badge',
  READY: 'badge-success',
  COLLECTED: 'badge-success',
  CANCELLED: 'badge-danger',
  WAITING: 'badge-warning',
  COMPLETED: 'badge-success',
  SUCCESS: 'badge-success',
  FAILED: 'badge-danger',
  PENDING: 'badge-warning',
  REQUESTED: 'badge-warning',
  APPROVED: 'badge',
  PROCESSED: 'badge-success',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${VARIANTS[status] ?? ''}`}>{status}</span>;
}
