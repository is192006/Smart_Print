import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

/**
 * Ensures a SHOP_STAFF user may only act on their own shop, derived from the
 * authenticated JWT — never from a shop_id the client supplies. ADMIN may act
 * on any shop. Expects the target shop id as req.params.shopId (numeric).
 */
export function requireOwnShop(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new UnauthorizedError();
  if (req.user.role === UserRole.ADMIN) return next();

  if (req.user.role === UserRole.SHOP_STAFF) {
    const targetShopId = Number(req.params.shopId);
    if (req.user.shopId === targetShopId) return next();
    throw new ForbiddenError('You do not have access to this shop');
  }

  throw new ForbiddenError('Only shop staff or admin may perform this action');
}
