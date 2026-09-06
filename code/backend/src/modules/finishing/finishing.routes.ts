import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import { requireOwnShop } from '../../middleware/shopAccess';
import * as finishingController from './finishing.controller';

export const finishingRouter = Router({ mergeParams: true });

finishingRouter.get('/', authenticate, finishingController.list);
finishingRouter.post(
  '/',
  authenticate,
  authorize(UserRole.SHOP_STAFF, UserRole.ADMIN),
  requireOwnShop,
  finishingController.upsert,
);
finishingRouter.patch(
  '/:finishingRuleId/active',
  authenticate,
  authorize(UserRole.SHOP_STAFF, UserRole.ADMIN),
  requireOwnShop,
  finishingController.setActive,
);
