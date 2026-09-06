import { Response } from 'express';

import * as pricingService from '../services/pricing.service';
import * as shopService from '../services/shop.service';
import { AuthenticatedRequest, AuthenticatedUser } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.userId;
}

function requireUser(req: AuthenticatedRequest): AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user;
}

// Listing "all" rules (including expired/future ones) is an administrative
// view - students/staff browsing pricing to configure an order only ever
// see what is currently effective. Requested via ?status=all. ADMIN may
// view any shop's full history; SHOP_STAFF only their own assigned shop
// (re-checked via shopService.assertShopAccess, never trusted from the URL).
async function wantsAllRules(req: AuthenticatedRequest): Promise<boolean> {
  const wantsAll = req.query.status === 'all';
  if (!wantsAll) {
    return false;
  }
  if (req.user?.role === 'ADMIN') {
    return true;
  }
  if (req.user?.role === 'SHOP_STAFF') {
    await shopService.assertShopAccess(req.user.userId, req.user.role, req.params.shopId);
    return true;
  }
  throw new ForbiddenError('Only administrators or shop staff may view all pricing rules');
}

export const createPricingRule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const rule = await pricingService.createPricingRule(req.params.shopId, req.body ?? {}, userId, role);
  res.status(201).json({ success: true, data: { pricingRule: rule } });
});

export const listPricingRules = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rules = await pricingService.listPricingRules(req.params.shopId, {
    current: !(await wantsAllRules(req)),
  });
  res.status(200).json({ success: true, data: { pricingRules: rules } });
});

export const deactivatePricingRule = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { userId, role } = requireUser(req);
    const { effectiveTo } = req.body ?? {};
    const rule = await pricingService.deactivatePricingRule(
      req.params.shopId,
      req.params.ruleId,
      effectiveTo,
      userId,
      role,
    );
    res.status(200).json({ success: true, data: { pricingRule: rule } });
  },
);

export const createFinishingRule = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { userId, role } = requireUser(req);
    const rule = await pricingService.createFinishingRule(req.params.shopId, req.body ?? {}, userId, role);
    res.status(201).json({ success: true, data: { finishingRule: rule } });
  },
);

export const listFinishingRules = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rules = await pricingService.listFinishingRules(req.params.shopId, {
    current: !(await wantsAllRules(req)),
  });
  res.status(200).json({ success: true, data: { finishingRules: rules } });
});

export const updateFinishingRule = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { userId, role } = requireUser(req);
    const rule = await pricingService.updateFinishingRule(
      req.params.shopId,
      req.params.ruleId,
      req.body ?? {},
      userId,
      role,
    );
    res.status(200).json({ success: true, data: { finishingRule: rule } });
  },
);

// Same authenticated-user pattern as order creation (order.controller.ts) -
// ownership of each referenced document is re-validated by the pricing
// service itself, never trusted from the request.
export const preview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const role = req.user!.role;
  const { shopId, items } = req.body ?? {};
  const result = await pricingService.calculatePricingPreview(userId, { shopId, items }, role);
  res.status(200).json({ success: true, data: result });
});
