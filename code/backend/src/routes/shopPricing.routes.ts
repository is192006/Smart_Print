import { Router } from 'express';

import * as pricingController from '../controllers/pricing.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

// Mounted at /api/shops - all routes here are scoped to a single :shopId.
// Mutations are ADMIN (any shop) or SHOP_STAFF (their own assigned shop
// only) - this cheap role check is just the first pass; the authoritative,
// DB-backed check that a SHOP_STAFF caller is ACTIVE and assigned to
// exactly this :shopId happens in pricing.service.ts via
// shopService.assertShopAccess. Reads stay open to any authenticated role.
export const shopPricingRouter = Router();

shopPricingRouter.use(authenticate);

shopPricingRouter.post(
  '/:shopId/pricing-rules',
  requireRole('ADMIN', 'SHOP_STAFF'),
  pricingController.createPricingRule,
);
shopPricingRouter.get('/:shopId/pricing-rules', pricingController.listPricingRules);
shopPricingRouter.patch(
  '/:shopId/pricing-rules/:ruleId/deactivate',
  requireRole('ADMIN', 'SHOP_STAFF'),
  pricingController.deactivatePricingRule,
);

shopPricingRouter.post(
  '/:shopId/finishing-rules',
  requireRole('ADMIN', 'SHOP_STAFF'),
  pricingController.createFinishingRule,
);
shopPricingRouter.get('/:shopId/finishing-rules', pricingController.listFinishingRules);
shopPricingRouter.patch(
  '/:shopId/finishing-rules/:ruleId',
  requireRole('ADMIN', 'SHOP_STAFF'),
  pricingController.updateFinishingRule,
);
