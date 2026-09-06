import { prisma } from '../../lib/prisma';
import { createOrderSequenceForShop } from '../../lib/sequences';
import { ConflictError, NotFoundError } from '../../lib/errors';

export async function listShops(activeOnly: boolean) {
  return prisma.printShop.findMany({
    where: activeOnly ? { isActive: true, acceptingOrders: true } : undefined,
    orderBy: { shopName: 'asc' },
  });
}

export async function getShop(shopId: number) {
  const shop = await prisma.printShop.findUnique({ where: { shopId } });
  if (!shop) throw new NotFoundError('Shop not found');
  return shop;
}

export interface CreateShopInput {
  shopCode: string;
  shopName: string;
  location?: string;
  contact?: string;
}

export async function createShop(input: CreateShopInput) {
  const existing = await prisma.printShop.findUnique({ where: { shopCode: input.shopCode } });
  if (existing) throw new ConflictError('shop_code already in use');

  return prisma.$transaction(async (tx) => {
    const shop = await tx.printShop.create({ data: input });
    // Native sequence backing this shop's human-readable order codes (A101, A102, ...).
    await createOrderSequenceForShop(tx, shop.shopCode);
    return shop;
  });
}

export interface UpdateShopInput {
  shopName?: string;
  location?: string;
  contact?: string;
  isActive?: boolean;
  acceptingOrders?: boolean;
}

export async function updateShop(shopId: number, input: UpdateShopInput) {
  await getShop(shopId);
  return prisma.printShop.update({ where: { shopId }, data: input });
}
