import { Router } from 'express';

import * as shopQueueController from '../controllers/shopQueue.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

// Mounted at /api/shops (same base as shopPricingRouter) - shop-scoped
// printing queue. Phase 8: this is now staff-operational data, not public
// shop info (contrast with shop.routes.ts, which stays open to students so
// they can pick a shop to print at) - every route here requires
// ADMIN or SHOP_STAFF at the role-middleware level (cheap first pass, no
// DB hit), and queueService/shopService.assertShopAccess then performs the
// authoritative, DB-backed check that a SHOP_STAFF caller is ACTIVE and
// assigned to exactly this :shopId - never trusting the URL param alone.
export const shopQueueRouter = Router();

shopQueueRouter.use(authenticate, requireRole('ADMIN', 'SHOP_STAFF'));

shopQueueRouter.get('/:shopId/queue', shopQueueController.list);
shopQueueRouter.get('/:shopId/queue/next', shopQueueController.next);
shopQueueRouter.get('/:shopId/queue/current', shopQueueController.current);
shopQueueRouter.post('/:shopId/queue/start-next', shopQueueController.startNext);
shopQueueRouter.patch('/:shopId/queue/:queueId/complete', shopQueueController.complete);
