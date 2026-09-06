import cors from 'cors';
import express, { Application } from 'express';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { adminStaffRouter } from './routes/adminStaff.routes';
import { authRouter } from './routes/auth.routes';
import { documentRouter } from './routes/document.routes';
import { healthRouter } from './routes/health.route';
import { orderRouter } from './routes/order.routes';
import { paymentRouter } from './routes/payment.routes';
import { pricingRouter } from './routes/pricing.routes';
import { queueRouter } from './routes/queue.routes';
import { refundRouter } from './routes/refund.routes';
import { shopRouter } from './routes/shop.routes';
import { shopPricingRouter } from './routes/shopPricing.routes';
import { shopQueueRouter } from './routes/shopQueue.routes';
import { testRouter } from './routes/test.routes';

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/orders', paymentRouter);
  app.use('/api/orders', refundRouter);
  app.use('/api/orders', queueRouter);
  app.use('/api/shops', shopRouter);
  app.use('/api/shops', shopPricingRouter);
  app.use('/api/shops', shopQueueRouter);
  app.use('/api/pricing', pricingRouter);
  app.use('/api/admin/staff', adminStaffRouter);

  // Development/testing-only role-middleware exercise routes - see
  // routes/test.routes.ts. Never mounted in production.
  if (env.nodeEnv !== 'production') {
    app.use('/api/test', testRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
