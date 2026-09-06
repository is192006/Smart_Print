import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import * as queueController from './queue.controller';

export const queueRouter = Router();

queueRouter.use(authenticate, authorize(UserRole.SHOP_STAFF, UserRole.ADMIN));

queueRouter.get('/', queueController.list);
queueRouter.post('/start-next', queueController.startNext);
queueRouter.patch('/:queueId/ready', queueController.markReady);
queueRouter.patch('/:queueId/cancel', queueController.cancel);
