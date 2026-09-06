export type RefundStatus = 'REQUESTED' | 'PROCESSED' | 'FAILED'

export interface SafeRefund {
  refundId: string
  paymentId: string
  orderId: string
  refundAmount: string
  refundReason: string
  refundStatus: RefundStatus
  refundTransactionId: string | null
  requestedAt: string
  processedAt: string | null
}
