import { Response } from 'express';

import * as orderService from '../services/order.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../utils/errors';

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.userId;
}

// Ownership always comes from the JWT (req.user.userId), never the request
// body - see order.service.ts for how each item's document ownership,
// shop, pricing, and finishing rule are independently re-validated
// server-side regardless of what the client sends.
export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const role = req.user!.role;
  const { shopId, items } = req.body ?? {};
  const order = await orderService.createOrder(userId, { shopId, items }, role);
  res.status(201).json({ success: true, data: { order } });
});

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const role = req.user!.role;
  const orders = await orderService.listOrdersForRequester(userId, role);
  res.status(200).json({ success: true, data: { orders } });
});

export const getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const role = req.user!.role;
  const order = await orderService.getOrderForRequester(userId, role, req.params.id);
  res.status(200).json({ success: true, data: { order } });
});

export const cancel = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const { reason } = req.body ?? {};
  const order = await orderService.cancelOrder(userId, req.params.id, reason);
  res.status(200).json({ success: true, data: { order } });
});
