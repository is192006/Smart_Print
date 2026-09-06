export type QueueStatus = 'WAITING' | 'PRINTING' | 'COMPLETED' | 'CANCELLED'

export interface SafeQueueEntry {
  queueId: string
  orderId: string
  orderCode: string
  shopId: string
  queueNumber: number
  queueStatus: QueueStatus
  enteredAt: string
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  position: number | null
}
