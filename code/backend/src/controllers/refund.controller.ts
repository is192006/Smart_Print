import { Response } from 'express';

import * as refundService from '../services/refund.service';
import { AuthenticatedRequest, AuthenticatedUser } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../utils/errors';

function requireUser(req: AuthenticatedRequest): AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user;
}

// Ownership comes from the JWT, not the request body - refund amount is
// never client-supplied either (full-refund-only policy, see
// refund.service.ts).
export const request = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = requireUser(req);
  const { reason } = req.body ?? {};
  const refund = await refundService.requestRefund(userId, req.params.orderId, { reason });
  res.status(201).json({ success: true, data: { refund } });
});

// ADMIN-only - enforced by requireRole('ADMIN') at the route level.
export const processRefund = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { simulateOutcome } = req.body ?? {};
  const refund = await refundService.processRefund(req.params.orderId, { simulateOutcome });
  res.status(200).json({ success: true, data: { refund } });
});

export const getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = requireUser(req);
  const refund = await refundService.getRefundForOrder(userId, role, req.params.orderId);
  res.status(200).json({ success: true, data: { refund } });
});
