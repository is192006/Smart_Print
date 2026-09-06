import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import * as refundsController from './refunds.controller';

export const refundsRouter = Router();

refundsRouter.use(authenticate);

refundsRouter.get('/', refundsController.list);
refundsRouter.post('/', refundsController.request);
refundsRouter.patch(
  '/:refundId/approve',
  authorize(UserRole.SHOP_STAFF, UserRole.ADMIN),
  refundsController.approve,
);
refundsRouter.patch(
  '/:refundId/process',
  authorize(UserRole.SHOP_STAFF, UserRole.ADMIN),
  refundsController.process,
);
