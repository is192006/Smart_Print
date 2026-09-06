import { RefundStatus } from '@prisma/client';

export interface RequestRefundInput {
  reason: unknown;
}

export interface ProcessRefundInput {
  // Mock-provider-only test hook - see mockPaymentProvider.ts.
  simulateOutcome?: unknown;
}

export interface SafeRefund {
  refundId: string;
  paymentId: string;
  orderId: string;
  refundAmount: string;
  refundReason: string;
  refundStatus: RefundStatus;
  refundTransactionId: string | null;
  requestedAt: Date;
  processedAt: Date | null;
}
