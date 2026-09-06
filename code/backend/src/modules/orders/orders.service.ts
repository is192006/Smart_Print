import { FinishingType, OrderStatus, PaperSize, Prisma, PrintType, Sides, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { nextOrderCode } from '../../lib/sequences';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuthUser } from '../../middleware/auth';

export interface OrderDocumentInput {
  documentId: number;
  printType: PrintType;
  paperSize: PaperSize;
  sides: Sides;
  copies: number;
  finishingType?: FinishingType;
}

export interface CreateOrderInput {
  shopId: number;
  documents: OrderDocumentInput[];
}

/**
 * Creates an order and its line items, computing prices from the shop's
 * *currently active* pricing/finishing rules and snapshotting those values
 * onto ORDER_DOCUMENT so historical orders never change when shop pricing
 * changes later. Nothing is charged yet — payment is a separate step.
 */
export async function createOrder(userId: number, input: CreateOrderInput) {
  if (input.documents.length === 0) {
    throw new BadRequestError('An order must include at least one document');
  }

  const shop = await prisma.printShop.findUnique({ where: { shopId: input.shopId } });
  if (!shop) throw new NotFoundError('Shop not found');
  if (!shop.isActive || !shop.acceptingOrders) {
    throw new BadRequestError('This shop is not currently accepting orders');
  }

  return prisma.$transaction(async (tx) => {
    const orderCode = await nextOrderCode(tx, shop.shopCode);

    const order = await tx.order.create({
      data: {
        orderCode,
        userId,
        shopId: shop.shopId,
        orderStatus: OrderStatus.CREATED,
        totalAmount: 0,
      },
    });

    let totalAmount = 0;

    for (const line of input.documents) {
      if (line.copies < 1) throw new BadRequestError('copies must be at least 1');

      const document = await tx.document.findUnique({ where: { documentId: line.documentId } });
      if (!document) throw new NotFoundError(`Document ${line.documentId} not found`);
      if (document.userId !== userId) {
        throw new ForbiddenError(`Document ${line.documentId} does not belong to you`);
      }

      const pricingRule = await tx.shopPricingRule.findFirst({
        where: {
          shopId: shop.shopId,
          printType: line.printType,
          paperSize: line.paperSize,
          sides: line.sides,
          effectiveTo: null,
        },
      });
      if (!pricingRule) {
        throw new BadRequestError(
          `This shop has no active pricing for ${line.printType}/${line.paperSize}/${line.sides}`,
        );
      }

      let finishingRuleId: number | null = null;
      let finishingPrice = 0;
      if (line.finishingType && line.finishingType !== FinishingType.NONE) {
        const finishingRule = await tx.shopFinishingRule.findFirst({
          where: {
            shopId: shop.shopId,
            finishingType: line.finishingType,
            effectiveTo: null,
            isActive: true,
          },
        });
        if (!finishingRule) {
          throw new BadRequestError(`This shop does not offer finishing type ${line.finishingType}`);
        }
        finishingRuleId = finishingRule.finishingRuleId;
        finishingPrice = Number(finishingRule.price);
      }

      const pricePerPage = Number(pricingRule.pricePerPage);
      const printingCost = document.pageCount * line.copies * pricePerPage;
      const lineTotal = printingCost + finishingPrice;
      totalAmount += lineTotal;

      await tx.orderDocument.create({
        data: {
          orderId: order.orderId,
          documentId: document.documentId,
          pricingRuleId: pricingRule.pricingRuleId,
          finishingRuleId,
          copies: line.copies,
          pricePerPage,
          finishingPrice,
          lineTotal,
        },
      });
    }

    await tx.order.update({
      where: { orderId: order.orderId },
      data: { totalAmount },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.orderId,
        status: OrderStatus.CREATED,
        changedByUserId: userId,
        notes: 'Order created',
      },
    });

    return getOrderDetail(order.orderId, tx);
  });
}

function orderScopeWhere(user: AuthUser) {
  if (user.role === UserRole.STUDENT) return { userId: user.userId };
  if (user.role === UserRole.SHOP_STAFF) return { shopId: user.shopId ?? -1 };
  return {}; // ADMIN
}

export async function listOrders(user: AuthUser, status?: OrderStatus) {
  return prisma.order.findMany({
    where: { ...orderScopeWhere(user), ...(status ? { orderStatus: status } : {}) },
    include: { shop: true, queue: true },
    orderBy: { createdAt: 'desc' },
  });
}

const orderDetailInclude = {
  shop: true,
  user: { select: { userId: true, name: true, email: true } },
  orderDocuments: { include: { document: true, pricingRule: true, finishingRule: true } },
  queue: true,
  payments: { orderBy: { createdAt: 'desc' as const } },
  statusHistory: { orderBy: { changedAt: 'desc' as const } },
};

async function getOrderDetail(orderId: number, db: Prisma.TransactionClient) {
  return db.order.findUnique({ where: { orderId }, include: orderDetailInclude });
}

export async function getOrderForUser(user: AuthUser, orderId: number) {
  const order = await prisma.order.findUnique({ where: { orderId }, include: orderDetailInclude });
  if (!order) throw new NotFoundError('Order not found');

  if (user.role === UserRole.STUDENT && order.userId !== user.userId) {
    throw new ForbiddenError('You cannot access this order');
  }
  if (user.role === UserRole.SHOP_STAFF && order.shopId !== user.shopId) {
    throw new ForbiddenError('You cannot access this order');
  }
  return order;
}

/** Shop staff mark an order collected once the student has picked it up. */
export async function markCollected(user: AuthUser, orderId: number) {
  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) throw new NotFoundError('Order not found');
  if (order.shopId !== user.shopId) throw new ForbiddenError('This order belongs to another shop');
  if (order.orderStatus !== OrderStatus.READY) {
    throw new BadRequestError('Only an order that is READY can be marked collected');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { orderId },
      data: { orderStatus: OrderStatus.COLLECTED },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: OrderStatus.COLLECTED,
        changedByUserId: user.userId,
        notes: 'Documents collected by student',
      },
    });
    return updated;
  });
}

export async function cancelOwnOrder(user: AuthUser, orderId: number, reason?: string) {
  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) throw new NotFoundError('Order not found');
  if (order.userId !== user.userId) throw new ForbiddenError('You cannot cancel this order');
  if (order.orderStatus !== OrderStatus.CREATED) {
    throw new BadRequestError('Only orders awaiting payment can be cancelled this way');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { orderId },
      data: {
        orderStatus: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason ?? 'Cancelled by student before payment',
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: OrderStatus.CANCELLED,
        changedByUserId: user.userId,
        notes: reason ?? 'Cancelled by student before payment',
      },
    });
    return updated;
  });
}
