import { UserRole } from '@prisma/client';
import { Request } from 'express';

export { UserRole };

// Minimal identity attached to the request by the auth middleware after
// verifying the JWT. Intentionally excludes password/contact details.
export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// User fields safe to return in API responses - never includes passwordHash.
// shopId is only ever non-null for SHOP_STAFF (see the users_shop_id_only_for_staff
// DB constraint) - included here so the staff frontend can discover which
// shop it operates without a separate lookup; every shop-scoped endpoint
// still independently re-derives and authorizes this from the database.
export interface SafeUser {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  shopId: string | null;
}
