import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { usersRouter } from '../modules/users/users.routes';
import { documentsRouter } from '../modules/documents/documents.routes';
import { shopsRouter } from '../modules/shops/shops.routes';
import { pricingRouter } from '../modules/pricing/pricing.routes';
import { finishingRouter } from '../modules/finishing/finishing.routes';
import { ordersRouter } from '../modules/orders/orders.routes';
import { queueRouter } from '../modules/queue/queue.routes';
import { paymentsRouter } from '../modules/payments/payments.routes';
import { refundsRouter } from '../modules/refunds/refunds.routes';
import { orderStatusRouter } from '../modules/orderStatus/orderStatus.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/shops', shopsRouter);
apiRouter.use('/shops/:shopId/pricing', pricingRouter);
apiRouter.use('/shops/:shopId/finishing', finishingRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/queue', queueRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/refunds', refundsRouter);
apiRouter.use('/order-status', orderStatusRouter);
