import { QueueStatus } from '@prisma/client';

export { QueueStatus };

// Safe, API-facing shape. position is always derived (never stored) - see
// queue.service.ts computePosition. null when the entry is not WAITING
// (PRINTING is reported as position 0 - "being printed right now"; a
// COMPLETED/CANCELLED entry has no meaningful position).
export interface SafeQueueEntry {
  queueId: string;
  orderId: string;
  orderCode: string;
  shopId: string;
  queueNumber: number;
  queueStatus: QueueStatus;
  enteredAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  position: number | null;
}
