import { api } from './apiClient'
import type { ApiSuccess, SafeRefund } from '@/types'

export const refundApi = {
  async request(orderId: string, reason: string): Promise<SafeRefund> {
    const res = await api.post<ApiSuccess<{ refund: SafeRefund }>>(`/orders/${orderId}/refund`, {
      reason,
    })
    return res.data.refund
  },

  async process(orderId: string, simulateOutcome?: 'SUCCESS' | 'FAILED'): Promise<SafeRefund> {
    const res = await api.patch<ApiSuccess<{ refund: SafeRefund }>>(
      `/orders/${orderId}/refund/process`,
      simulateOutcome ? { simulateOutcome } : undefined,
    )
    return res.data.refund
  },

  async getForOrder(orderId: string): Promise<SafeRefund> {
    const res = await api.get<ApiSuccess<{ refund: SafeRefund }>>(`/orders/${orderId}/refund`)
    return res.data.refund
  },
}
