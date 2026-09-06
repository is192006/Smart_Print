import { Router } from 'express';

import * as paymentController from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';

// Mounted at /api/orders (same base as order.routes.ts) - payment.service.ts
// itself enforces ownership, so no requireRole is needed here (mirrors
// order.routes.ts, which is student-self-service via ownership checks only).
export const paymentRouter = Router();

paymentRouter.use(authenticate);

paymentRouter.post('/:orderId/payment', paymentController.initiate);
paymentRouter.post('/:orderId/payment/confirm', paymentController.confirm);
paymentRouter.get('/:orderId/payment', paymentController.getOne);
