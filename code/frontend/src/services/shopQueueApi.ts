import { api } from './apiClient'
import type { ApiSuccess, SafeQueueEntry } from '@/types'

export const shopQueueApi = {
  async list(shopId: string, signal?: AbortSignal): Promise<SafeQueueEntry[]> {
    const res = await api.get<ApiSuccess<{ queue: SafeQueueEntry[] }>>(
      `/shops/${shopId}/queue`,
      signal,
    )
    return res.data.queue
  },

  async next(shopId: string, signal?: AbortSignal): Promise<SafeQueueEntry | null> {
    const res = await api.get<ApiSuccess<{ next: SafeQueueEntry | null }>>(
      `/shops/${shopId}/queue/next`,
      signal,
    )
    return res.data.next
  },

  async current(shopId: string, signal?: AbortSignal): Promise<SafeQueueEntry | null> {
    const res = await api.get<ApiSuccess<{ current: SafeQueueEntry | null }>>(
      `/shops/${shopId}/queue/current`,
      signal,
    )
    return res.data.current
  },

  async startNext(shopId: string): Promise<SafeQueueEntry> {
    const res = await api.post<ApiSuccess<{ queue: SafeQueueEntry }>>(
      `/shops/${shopId}/queue/start-next`,
    )
    return res.data.queue
  },

  async complete(shopId: string, queueId: string): Promise<SafeQueueEntry> {
    const res = await api.patch<ApiSuccess<{ queue: SafeQueueEntry }>>(
      `/shops/${shopId}/queue/${queueId}/complete`,
    )
    return res.data.queue
  },
}
