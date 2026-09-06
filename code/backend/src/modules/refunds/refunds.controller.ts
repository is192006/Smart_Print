import type { Request, Response } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../lib/errors';
import * as refundsService from './refunds.service';

const requestSchema = z.object({
  paymentId: z.number().int().positive(),
  refundAmount: z.number().positive(),
  refundReason: z.string().min(1).max(500),
});

export async function request(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const input = requestSchema.parse(req.body);
  res
    .status(201)
    .json(await refundsService.requestRefund(req.user, input.paymentId, input.refundAmount, input.refundReason));
}

export async function approve(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  res.json(await refundsService.approveRefund(req.user, Number(req.params.refundId)));
}

export async function process(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  res.json(await refundsService.processRefund(req.user, Number(req.params.refundId)));
}

export async function list(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  res.json(await refundsService.listRefunds(req.user));
}
