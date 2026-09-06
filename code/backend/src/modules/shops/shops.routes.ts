import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import * as shopsController from './shops.controller';

export const shopsRouter = Router();

shopsRouter.get('/', authenticate, shopsController.list);
shopsRouter.get('/:shopId', authenticate, shopsController.get);
shopsRouter.post('/', authenticate, authorize(UserRole.ADMIN), shopsController.create);
shopsRouter.patch('/:shopId', authenticate, authorize(UserRole.ADMIN), shopsController.update);
