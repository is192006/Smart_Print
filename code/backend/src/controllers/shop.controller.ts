import { Response } from 'express';

import * as shopService from '../services/shop.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../utils/errors';

export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { shopCode, shopName, location, contact, isActive, acceptingOrders } = req.body ?? {};
  const shop = await shopService.createShop({
    shopCode,
    shopName,
    location,
    contact,
    isActive,
    acceptingOrders,
  });
  res.status(201).json({ success: true, data: { shop } });
});

export const list = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const shops = await shopService.listShops();
  res.status(200).json({ success: true, data: { shops } });
});

export const getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const shop = await shopService.getShopSafe(req.params.shopId);
  res.status(200).json({ success: true, data: { shop } });
});

export const update = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const { shopName, location, contact, isActive, acceptingOrders } = req.body ?? {};
  const shop = await shopService.updateShop(
    req.params.shopId,
    { shopName, location, contact, isActive, acceptingOrders },
    { userId: req.user.userId, role: req.user.role },
  );
  res.status(200).json({ success: true, data: { shop } });
});
