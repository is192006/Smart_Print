import { api } from './apiClient'
import type { ApiSuccess, SafeShop } from '@/types'

export const shopApi = {
  async list(): Promise<SafeShop[]> {
    const res = await api.get<ApiSuccess<{ shops: SafeShop[] }>>('/shops')
    return res.data.shops
  },

  async getOne(shopId: string): Promise<SafeShop> {
    const res = await api.get<ApiSuccess<{ shop: SafeShop }>>(`/shops/${shopId}`)
    return res.data.shop
  },

  async create(input: {
    shopCode: string
    shopName: string
    location: string
    contact: string
    isActive?: boolean
    acceptingOrders?: boolean
  }): Promise<SafeShop> {
    const res = await api.post<ApiSuccess<{ shop: SafeShop }>>('/shops', input)
    return res.data.shop
  },

  async update(
    shopId: string,
    input: Partial<{
      shopName: string
      location: string
      contact: string
      isActive: boolean
      acceptingOrders: boolean
    }>,
  ): Promise<SafeShop> {
    const res = await api.patch<ApiSuccess<{ shop: SafeShop }>>(`/shops/${shopId}`, input)
    return res.data.shop
  },
}
