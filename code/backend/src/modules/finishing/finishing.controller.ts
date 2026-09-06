import type { Request, Response } from 'express';
import { z } from 'zod';
import { FinishingType } from '@prisma/client';
import * as finishingService from './finishing.service';

const upsertSchema = z.object({
  finishingType: z.nativeEnum(FinishingType),
  price: z.number().nonnegative(),
});

const activeSchema = z.object({ isActive: z.boolean() });

export async function list(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  const history = req.query.history === 'true';
  res.json(
    history
      ? await finishingService.listFinishingHistory(shopId)
      : await finishingService.listActiveFinishing(shopId),
  );
}

export async function upsert(req: Request, res: Response) {
  const input = upsertSchema.parse(req.body);
  res.status(201).json(await finishingService.upsertFinishingRule(Number(req.params.shopId), input));
}

export async function setActive(req: Request, res: Response) {
  const { isActive } = activeSchema.parse(req.body);
  res.json(await finishingService.setFinishingActive(Number(req.params.finishingRuleId), isActive));
}
