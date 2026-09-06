import { UserRole, UserStatus } from '@prisma/client';

export interface CreateStaffInput {
  name: unknown;
  email: unknown;
  phone: unknown;
  password: unknown;
  shopId: unknown;
}

export interface UpdateStaffInput {
  name?: unknown;
  shopId?: unknown;
  status?: unknown;
}

// Deliberately excludes passwordHash. Includes the assigned shop (a small
// safe summary, not the full SafeShop) since that's the entire point of
// this endpoint - never a bare shopId the caller would have to resolve
// themselves.
export interface SafeStaffUser {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  shop: {
    shopId: string;
    shopCode: string;
    shopName: string;
  } | null;
}
