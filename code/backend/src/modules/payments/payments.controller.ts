import type { Request, Response } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../lib/errors';
import * as paymentsService from './payments.service';

const initiateSchema = z.object({
  paymentMethod: z.string().min(1).max(30),
});

export async function initiate(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const { paymentMethod } = initiateSchema.parse(req.body);
  const result = await paymentsService.initiatePayment(req.user, Number(req.params.orderId), paymentMethod);
  res.status(result.payment.paymentStatus === 'SUCCESS' ? 201 : 402).json(result);
}

export async function listForOrder(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  res.json(await paymentsService.listPaymentsForOrder(req.user, Number(req.params.orderId)));
}
