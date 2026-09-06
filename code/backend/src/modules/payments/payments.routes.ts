import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import * as paymentsController from './payments.controller';

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

paymentsRouter.post('/orders/:orderId', authorize(UserRole.STUDENT), paymentsController.initiate);
paymentsRouter.get('/orders/:orderId', paymentsController.listForOrder);
