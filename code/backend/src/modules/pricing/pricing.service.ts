import { PaperSize, PrintType, Sides } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';

export async function listActivePricing(shopId: number) {
  return prisma.shopPricingRule.findMany({
    where: { shopId, effectiveTo: null },
    orderBy: [{ printType: 'asc' }, { paperSize: 'asc' }, { sides: 'asc' }],
  });
}

export async function listPricingHistory(shopId: number) {
  return prisma.shopPricingRule.findMany({
    where: { shopId },
    orderBy: { effectiveFrom: 'desc' },
  });
}

export interface UpsertPricingInput {
  printType: PrintType;
  paperSize: PaperSize;
  sides: Sides;
  pricePerPage: number;
}

/**
 * Creates a new pricing rule for a (printType, paperSize, sides) combination.
 * Any currently-open rule for the same combination is closed out
 * (effective_to = now()) in the same transaction, so there is never more than
 * one active rule per combination — overlapping/duplicate active rules are
 * prevented by construction rather than by a post-hoc check.
 */
export async function upsertPricingRule(shopId: number, input: UpsertPricingInput) {
  const shop = await prisma.printShop.findUnique({ where: { shopId } });
  if (!shop) throw new NotFoundError('Shop not found');

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.shopPricingRule.updateMany({
      where: {
        shopId,
        printType: input.printType,
        paperSize: input.paperSize,
        sides: input.sides,
        effectiveTo: null,
      },
      data: { effectiveTo: now },
    });

    return tx.shopPricingRule.create({
      data: {
        shopId,
        printType: input.printType,
        paperSize: input.paperSize,
        sides: input.sides,
        pricePerPage: input.pricePerPage,
        effectiveFrom: now,
      },
    });
  });
}
