import { NextFunction, Response } from 'express';

import { AuthenticatedRequest, UserRole } from '../types/auth.types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

// requireRole('ADMIN') or requireRole('SHOP_STAFF', 'ADMIN'). Must run after
// `authenticate` so req.user is already populated.
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('You do not have permission to access this resource'));
      return;
    }

    next();
  };
}
