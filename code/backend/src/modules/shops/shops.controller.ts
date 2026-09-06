import type { Request, Response } from 'express';
import { z } from 'zod';
import * as shopsService from './shops.service';

const createSchema = z.object({
  shopCode: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, 'shopCode must be alphanumeric'),
  shopName: z.string().min(1).max(150),
  location: z.string().max(255).optional(),
  contact: z.string().max(50).optional(),
});

const updateSchema = z.object({
  shopName: z.string().min(1).max(150).optional(),
  location: z.string().max(255).optional(),
  contact: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  acceptingOrders: z.boolean().optional(),
});

export async function list(req: Request, res: Response) {
  // Students only ever need to see shops open for business; staff/admin
  // manage the full list from the admin dashboard via ?all=true.
  const activeOnly = req.query.all !== 'true';
  res.json(await shopsService.listShops(activeOnly));
}

export async function get(req: Request, res: Response) {
  res.json(await shopsService.getShop(Number(req.params.shopId)));
}

export async function create(req: Request, res: Response) {
  const input = createSchema.parse(req.body);
  res.status(201).json(await shopsService.createShop(input));
}

export async function update(req: Request, res: Response) {
  const input = updateSchema.parse(req.body);
  res.json(await shopsService.updateShop(Number(req.params.shopId), input));
}
