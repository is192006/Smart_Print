export type UserRole = 'STUDENT' | 'SHOP_STAFF' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type PrintType = 'BW' | 'COLOR';
export type PaperSize = 'A4' | 'A3' | 'LETTER';
export type Sides = 'SINGLE' | 'DOUBLE';
export type FinishingType = 'NONE' | 'STAPLING' | 'SPIRAL_BINDING' | 'HARD_BINDING' | 'LAMINATION';
export type OrderStatus =
  | 'CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'QUEUED'
  | 'PRINTING'
  | 'READY'
  | 'COLLECTED'
  | 'CANCELLED';
export type QueueStatus = 'WAITING' | 'PRINTING' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'PROCESSED' | 'FAILED';

export interface AuthUser {
  userId: number;
  role: UserRole;
  shopId: number | null;
}

export interface MeResponse extends AuthUser {
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface Shop {
  shopId: number;
  shopCode: string;
  shopName: string;
  location: string | null;
  contact: string | null;
  isActive: boolean;
  acceptingOrders: boolean;
}

export interface PricingRule {
  pricingRuleId: number;
  shopId: number;
  printType: PrintType;
  paperSize: PaperSize;
  sides: Sides;
  pricePerPage: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface FinishingRule {
  finishingRuleId: number;
  shopId: number;
  finishingType: FinishingType;
  price: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface DocumentMeta {
  documentId: number;
  userId: number;
  fileName: string;
  fileUrl: string;
  pageCount: number;
  uploadedAt: string;
}

export interface Queue {
  queueId: number;
  orderId: number;
  queueNumber: number;
  queueStatus: QueueStatus;
  enteredAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface Payment {
  paymentId: number;
  orderId: number;
  amount: string;
  paymentMethod: string;
  transactionId: string;
  paymentStatus: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface Refund {
  refundId: number;
  paymentId: number;
  refundAmount: string;
  refundReason: string;
  refundStatus: RefundStatus;
  refundTransactionId: string | null;
  requestedAt: string;
  processedAt: string | null;
}

export interface OrderStatusHistoryEntry {
  historyId: number;
  orderId: number;
  status: OrderStatus;
  changedByUserId: number | null;
  changedAt: string;
  notes: string | null;
}

export interface Order {
  orderId: number;
  orderCode: string;
  userId: number;
  shopId: number;
  orderStatus: OrderStatus;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  shop?: Shop;
  queue?: Queue | null;
  payments?: Payment[];
  statusHistory?: OrderStatusHistoryEntry[];
  orderDocuments?: Array<{
    orderDocumentId: number;
    documentId: number;
    copies: number;
    pricePerPage: string;
    finishingPrice: string;
    lineTotal: string;
    document: DocumentMeta;
  }>;
}
