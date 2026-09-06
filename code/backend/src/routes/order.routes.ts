import { Router } from 'express';

import * as orderController from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';

export const orderRouter = Router();

orderRouter.use(authenticate);

orderRouter.post('/', orderController.create);
orderRouter.get('/', orderController.list);
orderRouter.get('/:id', orderController.getOne);
orderRouter.patch('/:id/cancel', orderController.cancel);
