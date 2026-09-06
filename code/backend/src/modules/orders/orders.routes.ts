import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import * as ordersController from './orders.controller';

export const ordersRouter = Router();

ordersRouter.use(authenticate);

ordersRouter.post('/', authorize(UserRole.STUDENT), ordersController.create);
ordersRouter.get('/', ordersController.list);
ordersRouter.get('/:orderId', ordersController.get);
ordersRouter.post('/:orderId/cancel', authorize(UserRole.STUDENT), ordersController.cancel);
ordersRouter.post('/:orderId/collect', authorize(UserRole.SHOP_STAFF), ordersController.collect);
