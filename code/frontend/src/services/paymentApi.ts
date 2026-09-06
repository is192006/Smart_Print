import { api } from './apiClient'
import type { ApiSuccess, PaymentMethod, SafePayment } from '@/types'

export const paymentApi = {
  async initiate(orderId: string, paymentMethod: PaymentMethod): Promise<SafePayment> {
    const res = await api.post<ApiSuccess<{ payment: SafePayment }>>(`/orders/${orderId}/payment`, {
      paymentMethod,
    })
    return res.data.payment
  },

  async confirm(orderId: string, simulateOutcome?: 'SUCCESS' | 'FAILED'): Promise<SafePayment> {
    const res = await api.post<ApiSuccess<{ payment: SafePayment }>>(
      `/orders/${orderId}/payment/confirm`,
      simulateOutcome ? { simulateOutcome } : undefined,
    )
    return res.data.payment
  },

  async getForOrder(orderId: string): Promise<SafePayment> {
    const res = await api.get<ApiSuccess<{ payment: SafePayment }>>(`/orders/${orderId}/payment`)
    return res.data.payment
  },
}
