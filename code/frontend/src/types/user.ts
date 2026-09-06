export type UserRole = 'STUDENT' | 'FACULTY' | 'SHOP_STAFF' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface SafeUser {
  userId: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  status: UserStatus
  shopId: string | null
}

export interface AuthResult {
  user: SafeUser
  token: string
}
