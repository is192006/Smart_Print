import { User } from '@prisma/client';

import { SafeUser } from '../types/auth.types';

// Strips passwordHash (and anything else non-public) before a user record
// is ever sent in an API response.
export function toSafeUser(user: User): SafeUser {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    shopId: user.shopId,
  };
}
