import { UserRole } from '@prisma/client';
import { Response } from 'express';

import * as queueService from '../services/queue.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../utils/errors';

function requireUser(req: AuthenticatedRequest): { userId: string; role: UserRole } {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return { userId: req.user.userId, role: req.user.role };
}

// Owner-or-admin, same pattern as refund.controller.ts.
export const getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const queue = await queueService.getQueueEntryForOrder(userId, role, req.params.orderId);
  res.status(200).json({ success: true, data: { queue } });
});

export const getPosition = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const position = await queueService.getQueuePositionForOrder(userId, role, req.params.orderId);
  res.status(200).json({ success: true, data: position });
});

// ADMIN or SHOP_STAFF assigned to the order's shop - see
// queueService.collectOrder/shopService.assertShopAccess.
export const collect = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  await queueService.collectOrder(userId, role, req.params.orderId);
  res.status(200).json({ success: true, data: { orderId: req.params.orderId, orderStatus: 'COLLECTED' } });
});
