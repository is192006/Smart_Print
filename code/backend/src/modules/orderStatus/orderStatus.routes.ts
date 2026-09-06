import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as orderStatusController from './orderStatus.controller';

export const orderStatusRouter = Router();

orderStatusRouter.get('/:orderId', authenticate, orderStatusController.history);
