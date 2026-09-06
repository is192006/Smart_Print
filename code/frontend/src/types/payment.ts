export type PaymentMethod = 'UPI' | 'CARD' | 'WALLET' | 'CASH'
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface SafePayment {
  paymentId: string
  orderId: string
  amount: string
  paymentMethod: PaymentMethod
  transactionId: string
  paymentStatus: PaymentStatus
  createdAt: string
  paidAt: string | null
}
