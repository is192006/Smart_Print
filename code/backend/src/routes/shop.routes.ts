import { Router } from 'express';

import * as shopController from '../controllers/shop.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

// Mounted at /api/shops, alongside shopPricingRouter/shopQueueRouter - basic
// shop directory/management. Reads are open to any authenticated role
// (students need this to pick a shop to print at). Creating a shop stays
// ADMIN-only. Updating a shop is ADMIN (any shop, any field) or SHOP_STAFF
// (their own assigned shop only, and only the acceptingOrders field - see
// shopService.updateShop for the authoritative, DB-backed enforcement).
export const shopRouter = Router();

shopRouter.use(authenticate);

shopRouter.post('/', requireRole('ADMIN'), shopController.create);
shopRouter.get('/', shopController.list);
shopRouter.get('/:shopId', shopController.getOne);
shopRouter.patch('/:shopId', requireRole('ADMIN', 'SHOP_STAFF'), shopController.update);
