import type { UserRole, UserStatus } from './user'

export interface SafeStaffUser {
  userId: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  status: UserStatus
  shop: { shopId: string; shopCode: string; shopName: string } | null
}
