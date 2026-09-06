import type { Request, Response } from 'express';
import { z } from 'zod';
import { FinishingType, OrderStatus, PaperSize, PrintType, Sides } from '@prisma/client';
import { UnauthorizedError } from '../../lib/errors';
import * as ordersService from './orders.service';

const orderDocumentSchema = z.object({
  documentId: z.number().int().positive(),
  printType: z.nativeEnum(PrintType),
  paperSize: z.nativeEnum(PaperSize),
  sides: z.nativeEnum(Sides),
  copies: z.number().int().positive(),
  finishingType: z.nativeEnum(FinishingType).optional(),
});

const createOrderSchema = z.object({
  shopId: z.number().int().positive(),
  documents: z.array(orderDocumentSchema).min(1),
});

const cancelSchema = z.object({ reason: z.string().max(500).optional() });

export async function create(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const input = createOrderSchema.parse(req.body);
  res.status(201).json(await ordersService.createOrder(req.user.userId, input));
}

export async function list(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const status = req.query.status ? (req.query.status as OrderStatus) : undefined;
  res.json(await ordersService.listOrders(req.user, status));
}

export async function get(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  res.json(await ordersService.getOrderForUser(req.user, Number(req.params.orderId)));
}

export async function cancel(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const { reason } = cancelSchema.parse(req.body);
  res.json(await ordersService.cancelOwnOrder(req.user, Number(req.params.orderId), reason));
}

export async function collect(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  res.json(await ordersService.markCollected(req.user, Number(req.params.orderId)));
}
