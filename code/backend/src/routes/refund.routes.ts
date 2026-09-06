import { Router } from 'express';

import * as refundController from '../controllers/refund.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

// Mounted at /api/orders. Requesting a refund is ownership-gated (like
// order.routes.ts); processing one is ADMIN-only - SHOP_STAFF is not
// granted this (see refund.service.ts for why: no shop-staff linkage
// exists yet, same deferral as Phase 5's pricing-rule management).
export const refundRouter = Router();

refundRouter.use(authenticate);

refundRouter.post('/:orderId/refund', refundController.request);
refundRouter.patch('/:orderId/refund/process', requireRole('ADMIN'), refundController.processRefund);
refundRouter.get('/:orderId/refund', refundController.getOne);
