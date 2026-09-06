import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import { requireOwnShop } from '../../middleware/shopAccess';
import * as pricingController from './pricing.controller';

export const pricingRouter = Router({ mergeParams: true });

pricingRouter.get('/', authenticate, pricingController.list);
pricingRouter.post(
  '/',
  authenticate,
  authorize(UserRole.SHOP_STAFF, UserRole.ADMIN),
  requireOwnShop,
  pricingController.upsert,
);
