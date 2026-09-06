import type { Request, Response } from 'express';
import { z } from 'zod';
import { QueueStatus, UserRole } from '@prisma/client';
import { BadRequestError, UnauthorizedError } from '../../lib/errors';
import * as queueService from './queue.service';

const cancelSchema = z.object({ reason: z.string().max(500).optional() });

/** SHOP_STAFF always act on their own shop; ADMIN must specify ?shopId=. */
function resolveShopId(req: Request): number {
  if (!req.user) throw new UnauthorizedError();
  if (req.user.role === UserRole.SHOP_STAFF) {
    if (!req.user.shopId) throw new BadRequestError('This staff account is not assigned to a shop');
    return req.user.shopId;
  }
  const shopId = Number(req.query.shopId);
  if (!shopId) throw new BadRequestError('shopId query parameter is required for admin');
  return shopId;
}

export async function list(req: Request, res: Response) {
  const shopId = resolveShopId(req);
  const status = req.query.status ? (req.query.status as QueueStatus) : undefined;
  res.json(await queueService.listQueue(shopId, status));
}

export async function startNext(req: Request, res: Response) {
  const shopId = resolveShopId(req);
  res.status(201).json(await queueService.startNext(shopId));
}

export async function markReady(req: Request, res: Response) {
  const shopId = resolveShopId(req);
  res.json(await queueService.markReady(shopId, Number(req.params.queueId)));
}

export async function cancel(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const shopId = resolveShopId(req);
  const { reason } = cancelSchema.parse(req.body);
  res.json(await queueService.cancelQueueEntry(req.user, shopId, Number(req.params.queueId), reason));
}
