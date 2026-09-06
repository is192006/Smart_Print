import { Router } from 'express';

import { AuthenticatedRequest } from '../types/auth.types';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

// DEVELOPMENT/TESTING ONLY.
// These routes exist solely to exercise the auth + role middleware
// (authenticate / requireRole) in isolation, since no real STUDENT / SHOP_STAFF
// / ADMIN business endpoints exist yet. They are not SmartPrint business
// functionality and are only mounted when NODE_ENV !== 'production'
// (see app.ts). Remove once real role-protected endpoints exist.
export const testRouter = Router();

testRouter.get(
  '/student',
  authenticate,
  requireRole('STUDENT'),
  (req: AuthenticatedRequest, res) => {
    res.status(200).json({ success: true, role: req.user?.role });
  },
);

testRouter.get(
  '/shop-staff',
  authenticate,
  requireRole('SHOP_STAFF'),
  (req: AuthenticatedRequest, res) => {
    res.status(200).json({ success: true, role: req.user?.role });
  },
);

testRouter.get('/admin', authenticate, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  res.status(200).json({ success: true, role: req.user?.role });
});
