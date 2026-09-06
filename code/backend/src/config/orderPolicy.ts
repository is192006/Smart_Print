// Business-policy constants for order creation. Plain constants rather than
// env vars - unlike UPLOAD_DIR/MAX_FILE_SIZE_MB (Phase 3), nothing in the
// existing project configures these today, and there's no concrete need yet
// to make them deployment-tunable.
export const MAX_ITEMS_PER_ORDER = 20;
export const MAX_COPIES_PER_ITEM = 100;
export const MAX_SPECIAL_INSTRUCTIONS_LENGTH = 500;

// Statuses from which a student may still cancel their own order. Printing
// has not started for any of these. Deliberately excludes PRINTING, READY,
// COLLECTED, and CANCELLED itself.
export const CANCELLABLE_ORDER_STATUSES = ['PLACED', 'PAYMENT_CONFIRMED', 'QUEUED'] as const;

// Phase 6: an order accepts a new payment attempt only while PLACED. Once a
// payment succeeds the order moves to PAYMENT_CONFIRMED and is no longer
// payable - this single check is what stops a second successful charge on
// the same order, on top of the PENDING-payment guard in payment.service.ts.
export const PAYABLE_ORDER_STATUSES = ['PLACED'] as const;

// A refund may only be requested once the order has actually been
// cancelled (via the existing Phase 4 cancellation flow) - refunds are
// never available for an order that is still active or has completed.
export const REFUNDABLE_ORDER_STATUSES = ['CANCELLED'] as const;

export const MAX_REFUND_REASON_LENGTH = 500;
