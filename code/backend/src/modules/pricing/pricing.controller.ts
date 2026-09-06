import type { Request, Response } from 'express';
import { z } from 'zod';
import { PaperSize, PrintType, Sides } from '@prisma/client';
import * as pricingService from './pricing.service';

const upsertSchema = z.object({
  printType: z.nativeEnum(PrintType),
  paperSize: z.nativeEnum(PaperSize),
  sides: z.nativeEnum(Sides),
  pricePerPage: z.number().positive(),
});

export async function list(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const history = req.query.history === 'true';
  res.json(history ? await pricingService.listPricingHistory(shopId) : await pricingService.listActivePricing(shopId));
}

export async function upsert(req: Request, res: Response) {
  const input = upsertSchema.parse(req.body);
  res.status(201).json(await pricingService.upsertPricingRule(Number(req.params.shopId), input));
}
