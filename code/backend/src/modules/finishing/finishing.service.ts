import { FinishingType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';

export async function listActiveFinishing(shopId: number) {
  return prisma.shopFinishingRule.findMany({
    where: { shopId, effectiveTo: null, isActive: true },
    orderBy: { finishingType: 'asc' },
  });
}

export async function listFinishingHistory(shopId: number) {
  return prisma.shopFinishingRule.findMany({
    where: { shopId },
    orderBy: { effectiveFrom: 'desc' },
  });
}

export interface UpsertFinishingInput {
  finishingType: FinishingType;
  price: number;
}

/** Same supersede pattern as pricing rules: closes any open rule for this type. */
export async function upsertFinishingRule(shopId: number, input: UpsertFinishingInput) {
  const shop = await prisma.printShop.findUnique({ where: { shopId } });
  if (!shop) throw new NotFoundError('Shop not found');

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.shopFinishingRule.updateMany({
      where: { shopId, finishingType: input.finishingType, effectiveTo: null },
      data: { effectiveTo: now },
    });

    return tx.shopFinishingRule.create({
      data: {
        shopId,
        finishingType: input.finishingType,
        price: input.price,
        effectiveFrom: now,
      },
    });
  });
}

export async function setFinishingActive(finishingRuleId: number, isActive: boolean) {
  const rule = await prisma.shopFinishingRule.findUnique({ where: { finishingRuleId } });
  if (!rule) throw new NotFoundError('Finishing rule not found');
  return prisma.shopFinishingRule.update({ where: { finishingRuleId }, data: { isActive } });
}
