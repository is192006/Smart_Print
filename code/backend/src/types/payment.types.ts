import { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface InitiatePaymentInput {
  paymentMethod: unknown;
}

// Mock-provider-only test hook (see mockPaymentProvider.ts) - never present
// on a real gateway's callback shape, which would instead carry a signed
// payload the backend verifies rather than trusts.
export interface ConfirmPaymentInput {
  simulateOutcome?: unknown;
}

// Safe, API-facing shape - amount is a string (Decimal.toString()), same
// convention as SafeOrder.totalAmount.
export interface SafePayment {
  paymentId: string;
  orderId: string;
  amount: string;
  paymentMethod: PaymentMethod;
  transactionId: string;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  paidAt: Date | null;
}
