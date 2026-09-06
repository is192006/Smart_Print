import { api } from './apiClient'
import type { ApiSuccess, SafeQueueEntry } from '@/types'

export const queueApi = {
  async getForOrder(orderId: string, signal?: AbortSignal): Promise<SafeQueueEntry> {
    const res = await api.get<ApiSuccess<{ queue: SafeQueueEntry }>>(`/orders/${orderId}/queue`, signal)
    return res.data.queue
  },

  async getPosition(orderId: string, signal?: AbortSignal): Promise<number | null> {
    const res = await api.get<ApiSuccess<{ position: number | null }>>(
      `/orders/${orderId}/queue-position`,
      signal,
    )
    return res.data.position
  },

  async collect(orderId: string): Promise<void> {
    await api.patch(`/orders/${orderId}/collect`)
  },
}
