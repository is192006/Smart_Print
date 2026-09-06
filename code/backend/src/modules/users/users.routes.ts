import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import * as usersController from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate, authorize(UserRole.ADMIN));

usersRouter.get('/', usersController.list);
usersRouter.post('/', usersController.create);
usersRouter.patch('/:userId/status', usersController.updateStatus);
usersRouter.patch('/:userId/shop', usersController.assignShop);
