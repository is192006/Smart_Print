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

// Phase 8: all of these are shop-scoped via queueService/shopService's
// assertShopAccess (ADMIN -> any shop, SHOP_STAFF -> their own assigned
// shop only, STUDENT -> never) - see role.middleware's requireRole on the
// route for the cheap first-pass filter, and shop.service.ts::assertShopAccess
// for the authoritative, DB-backed check.

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const queue = await queueService.listWaitingQueueForShop(userId, role, req.params.shopId);
  res.status(200).json({ success: true, data: { queue } });
});

export const next = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const next = await queueService.getNextForShop(userId, role, req.params.shopId);
  res.status(200).json({ success: true, data: { next } });
});

export const current = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const current = await queueService.getCurrentForShop(userId, role, req.params.shopId);
  res.status(200).json({ success: true, data: { current } });
});

export const startNext = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const queue = await queueService.startNextForShop(userId, role, req.params.shopId);
  res.status(200).json({ success: true, data: { queue } });
});

export const complete = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const queue = await queueService.completeQueueEntry(userId, role, req.params.shopId, req.params.queueId);
  res.status(200).json({ success: true, data: { queue } });
});
