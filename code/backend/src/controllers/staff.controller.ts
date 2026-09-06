import { Response } from 'express';

import * as staffService from '../services/staff.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';

// All ADMIN-only, enforced at the route level.

export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, phone, password, shopId } = req.body ?? {};
  const staff = await staffService.createStaff({ name, email, phone, password, shopId });
  res.status(201).json({ success: true, data: { staff } });
});

export const list = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const staff = await staffService.listStaff();
  res.status(200).json({ success: true, data: { staff } });
});

export const update = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, shopId, status } = req.body ?? {};
  const staff = await staffService.updateStaff(req.params.id, { name, shopId, status });
  res.status(200).json({ success: true, data: { staff } });
});
