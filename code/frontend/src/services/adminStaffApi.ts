import { api } from './apiClient'
import type { ApiSuccess, SafeStaffUser, UserStatus } from '@/types'

export const adminStaffApi = {
  async list(): Promise<SafeStaffUser[]> {
    const res = await api.get<ApiSuccess<{ staff: SafeStaffUser[] }>>('/admin/staff')
    return res.data.staff
  },

  async create(input: {
    name: string
    email: string
    phone?: string
    password: string
    shopId: string
  }): Promise<SafeStaffUser> {
    const res = await api.post<ApiSuccess<{ staff: SafeStaffUser }>>('/admin/staff', input)
    return res.data.staff
  },

  async update(
    staffId: string,
    input: Partial<{ name: string; shopId: string; status: UserStatus }>,
  ): Promise<SafeStaffUser> {
    const res = await api.patch<ApiSuccess<{ staff: SafeStaffUser }>>(`/admin/staff/${staffId}`, input)
    return res.data.staff
  },
}
