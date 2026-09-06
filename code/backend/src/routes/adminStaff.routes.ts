import { Router } from 'express';

import * as staffController from '../controllers/staff.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

// Mounted at /api/admin/staff. ADMIN-only shop-staff management (creation
// with a required shop assignment, listing, and reassignment/deactivation).
// Distinct from the existing POST /api/auth/staff (Phase 2), which still
// creates an unassigned SHOP_STAFF account and is left untouched - an
// admin can assign a shop afterward via PATCH here. This endpoint is the
// full CRUD surface Phase 8 adds on top of that.
export const adminStaffRouter = Router();

adminStaffRouter.use(authenticate, requireRole('ADMIN'));

adminStaffRouter.post('/', staffController.create);
adminStaffRouter.get('/', staffController.list);
adminStaffRouter.patch('/:id', staffController.update);
