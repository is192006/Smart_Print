import { Router } from 'express';

import * as pricingController from '../controllers/pricing.controller';
import { authenticate } from '../middleware/auth.middleware';

export const pricingRouter = Router();

pricingRouter.use(authenticate);

pricingRouter.post('/preview', pricingController.preview);
