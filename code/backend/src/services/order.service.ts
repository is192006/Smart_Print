import { randomUUID } from 'node:crypto';

import { Order, OrderDocument, OrderStatusHistory, Prisma, PrintShop, UserRole } from '@prisma/client';

import { CANCELLABLE_ORDER_STATUSES, MAX_SPECIAL_INSTRUCTIONS_LENGTH } from '../config/orderPolicy';
import { prisma } from '../config/prisma';
import * as pricingService from './pricing.service';
import * as queueService from './queue.service';
import * as shopService from './shop.service';
import {
  CreateOrderInput,
  CreateOrderItemInput,
  SafeOrder,
  SafeOrderItem,
  SafeOrderStatusEvent,
} from '../types/order.types';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { generateOrderCode } from '../utils/orderCode';

type OrderWithRelations = Order & {
  shop: PrintShop;
  user: { name: string; email: string };
  orderDocuments: (OrderDocument & {
    document: { fileName: string };
    pricingRule: { printType: string; paperSize: string; sides: string };
    finishingRule: { finishingType: string } | null;
  })[];
  statusHistory: OrderStatusHistory[];
};

const ORDER_INCLUDE = {
  shop: true,
  user: { select: { name: true, email: true } },
  orderDocuments: {
    include: {
      document: { select: { fileName: true } },
      pricingRule: { select: { printType: true, paperSize: true, sides: true } },
      finishingRule: { select: { finishingType: true } },
    },
  },
  statusHistory: { orderBy: { changedAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

function toSafeOrder(order: OrderWithRelations): SafeOrder {
  const items: SafeOrderItem[] = order.orderDocuments.map((item) => ({
    orderDocumentId: item.orderDocumentId,
    documentId: item.documentId,
    fileName: item.document.fileName,
    printType: item.pricingRule.printType as SafeOrderItem['printType'],
    paperSize: item.pricingRule.paperSize as SafeOrderItem['paperSize'],
    sides: item.pricingRule.sides as SafeOrderItem['sides'],
    copies: item.copies,
    pageRange: item.pageRange,
    printPageCount: item.printPageCount,
    finishingType: (item.finishingRule?.finishingType as SafeOrderItem['finishingType']) ?? null,
    specialInstructions: item.specialInstructions,
    pricePerPage: item.pricePerPage.toString(),
    finishingPrice: item.finishingPrice.toString(),
    lineTotal: item.lineTotal.toString(),
  }));

  const statusHistory: SafeOrderStatusEvent[] = order.statusHistory.map((event) => ({
    status: event.status,
    changedByUserId: event.changedByUserId,
    changedAt: event.changedAt,
    notes: event.notes,
  }));

  return {
    orderId: order.orderId,
    orderCode: order.orderCode,
    shopId: order.shopId,
    shopName: order.shop.shopName,
    customerName: order.user.name,
    customerEmail: order.user.email,
    orderStatus: order.orderStatus,
    totalAmount: order.totalAmount.toString(),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cancelledAt: order.cancelledAt,
    cancelledReason: order.cancelledReason,
    items,
    statusHistory,
  };
}

function assertValidSpecialInstructions(
  specialInstructions: unknown,
): asserts specialInstructions is string | undefined {
  if (specialInstructions === undefined || specialInstructions === null) {
    return;
  }
  if (typeof specialInstructions !== 'string') {
    throw new ValidationError('specialInstructions must be a string');
  }
  if (specialInstructions.length > MAX_SPECIAL_INSTRUCTIONS_LENGTH) {
    throw new ValidationError(
      `specialInstructions may not exceed ${MAX_SPECIAL_INSTRUCTIONS_LENGTH} characters`,
    );
  }
}

interface ResolvedItem {
  documentId: string;
  pricingRuleId: string;
  finishingRuleId: string | null;
  copies: number;
  printPageCount: number;
  pageRange: string | null;
  specialInstructions: string | null;
  pricePerPage: Prisma.Decimal;
  finishingPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

// Document ownership, page-range selection, applicable pricing rule,
// optional finishing rule, and Decimal cost calculation are all resolved by
// the shared pricing service (see pricing.service.ts) - the pricing preview
// endpoint calls the exact same function, so order creation and preview can
// never disagree on price.
async function resolveOrderItem(
  userId: string,
  shopId: string,
  raw: CreateOrderItemInput,
): Promise<ResolvedItem> {
  assertValidSpecialInstructions(raw.specialInstructions);

  const resolved = await pricingService.resolveAndPriceItem(userId, shopId, raw);

  return {
    documentId: resolved.documentId,
    pricingRuleId: resolved.pricingRule.pricingRuleId,
    finishingRuleId: resolved.finishingRule?.finishingRuleId ?? null,
    copies: resolved.copies,
    printPageCount: resolved.printPageCount,
    pageRange: resolved.pageRangeString,
    specialInstructions:
      typeof raw.specialInstructions === 'string' ? raw.specialInstructions.trim() || null : null,
    pricePerPage: resolved.pricingRule.pricePerPage,
    finishingPrice: resolved.finishingCost,
    lineTotal: resolved.lineTotal,
  };
}

// Transactional: Order + all OrderDocument rows + the initial
// OrderStatusHistory row are created atomically. Any failure (bad
// reference, DB error, unique-constraint clash on orderCode) rolls back
// everything - no partial order is ever left behind.
export async function createOrder(
  userId: string,
  input: CreateOrderInput,
  role: UserRole,
): Promise<SafeOrder> {
  pricingService.assertValidShopId(input.shopId);
  pricingService.assertValidItemsArray(input.items);

  const shop = await shopService.assertShopAcceptsOrders(input.shopId);
  shopService.assertShopEligibleForRole(shop, role);

  // Client-supplied prices (pricePerPage/finishingPrice/lineTotal/totalAmount)
  // are never read from the request at all - every price below is resolved
  // from resolveOrderItem, which only ever reads from the database.
  const resolvedItems: ResolvedItem[] = [];
  for (const rawItem of input.items as CreateOrderItemInput[]) {
    resolvedItems.push(await resolveOrderItem(userId, shop.shopId, rawItem));
  }

  // FACULTY printing at the CSE Department Faculty Printer is a free
  // institutional entitlement (see shopService.isFreeFacultyShop): the
  // snapshot price on every item, and the order total, are zeroed here -
  // never merely "skipped at payment time" - so the order itself is
  // authoritatively ₹0 regardless of what the shop's pricing rules say.
  const isFreeFacultyOrder = shopService.isFreeFacultyShop(shop, role);
  const zero = new Prisma.Decimal(0);
  const finalItems = isFreeFacultyOrder
    ? resolvedItems.map((item) => ({
        ...item,
        pricePerPage: zero,
        finishingPrice: zero,
        lineTotal: zero,
      }))
    : resolvedItems;

  const totalAmount = isFreeFacultyOrder
    ? zero
    : finalItems.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));

  const orderId = randomUUID();
  const orderCode = generateOrderCode();

  const created = await prisma.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        orderId,
        orderCode,
        userId,
        shopId: shop.shopId,
        orderStatus: 'PLACED',
        totalAmount,
      },
    });

    await tx.orderDocument.createMany({
      data: finalItems.map((item) => ({
        orderId,
        documentId: item.documentId,
        pricingRuleId: item.pricingRuleId,
        finishingRuleId: item.finishingRuleId,
        copies: item.copies,
        printPageCount: item.printPageCount,
        pageRange: item.pageRange,
        specialInstructions: item.specialInstructions,
        pricePerPage: item.pricePerPage,
        finishingPrice: item.finishingPrice,
        lineTotal: item.lineTotal,
      })),
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'PLACED',
        changedByUserId: userId,
        notes: 'Order placed by student',
      },
    });

    // No payment is ever created for a free faculty order - it enters the
    // shop's FIFO queue immediately, atomically with order creation, the
    // same way a paid order enters it atomically with payment confirmation
    // (see payment.service.ts::confirmPayment). This is still the single
    // CSE_FACULTY queue - no separate faculty queue is created.
    if (isFreeFacultyOrder) {
      await queueService.enqueueOrderWithinTransaction(tx, shop.shopId, orderId, userId);
    }

    return tx.order.findUniqueOrThrow({ where: { orderId }, include: ORDER_INCLUDE });
  });

  return toSafeOrder(created);
}

export async function listOrdersForUser(userId: string): Promise<SafeOrder[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: ORDER_INCLUDE,
  });
  return orders.map(toSafeOrder);
}

// Role-scoped order visibility for GET /api/orders, mirroring the same
// (ADMIN: everything / SHOP_STAFF: own shop only / everyone else: own
// orders only) pattern already used by queue.service.ts::getQueueEntryForOrder.
// A SHOP_STAFF caller who is inactive or has no shop assignment sees an
// empty list rather than an error, matching how they'd see no queue at all.
export async function listOrdersForRequester(userId: string, role: UserRole): Promise<SafeOrder[]> {
  if (role === 'ADMIN') {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return orders.map(toSafeOrder);
  }

  if (role === 'SHOP_STAFF') {
    const staffUser = await prisma.user.findUnique({ where: { userId } });
    if (!staffUser || staffUser.status !== 'ACTIVE' || !staffUser.shopId) {
      return [];
    }
    const orders = await prisma.order.findMany({
      where: { shopId: staffUser.shopId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return orders.map(toSafeOrder);
  }

  return listOrdersForUser(userId);
}

// Role-scoped single-order lookup for GET /api/orders/:id, same pattern as
// listOrdersForRequester above: ADMIN may view any order, SHOP_STAFF only an
// order belonging to their own (ACTIVE) assigned shop - re-derived from the
// database via shopService.assertShopAccess, never trusted from the order
// itself - and every other role only ever sees their own order.
export async function getOrderForRequester(
  requestingUserId: string,
  requestingUserRole: UserRole,
  orderId: string,
): Promise<SafeOrder> {
  if (requestingUserRole === 'ADMIN') {
    const order = await prisma.order.findUnique({ where: { orderId }, include: ORDER_INCLUDE });
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return toSafeOrder(order);
  }

  if (requestingUserRole === 'SHOP_STAFF') {
    const order = await prisma.order.findUnique({ where: { orderId }, include: ORDER_INCLUDE });
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    await shopService.assertShopAccess(requestingUserId, requestingUserRole, order.shopId);
    return toSafeOrder(order);
  }

  return getOrderForUser(requestingUserId, orderId);
}

// Same not-found-vs-not-owned indistinguishability pattern as documents: a
// student probing another student's order ID gets a plain 404.
async function findOwnedOrderOrThrow(userId: string, orderId: string): Promise<OrderWithRelations> {
  const order = await prisma.order.findUnique({ where: { orderId }, include: ORDER_INCLUDE });
  if (!order || order.userId !== userId) {
    throw new NotFoundError('Order not found');
  }
  return order;
}

export async function getOrderForUser(userId: string, orderId: string): Promise<SafeOrder> {
  const order = await findOwnedOrderOrThrow(userId, orderId);
  return toSafeOrder(order);
}

// Raw-row lookups for other services (Phase 6 payments/refunds) that need
// the unmapped Order (Decimal totalAmount, current orderStatus) rather than
// the toSafeOrder-mapped shape. Same not-found-vs-not-owned 404 pattern as
// findOwnedOrderOrThrow above.
export async function getOwnedOrderRowOrThrow(userId: string, orderId: string): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order || order.userId !== userId) {
    throw new NotFoundError('Order not found');
  }
  return order;
}

// No ownership check - for administrative flows (e.g. refund processing)
// that act on an order they do not themselves own.
export async function getOrderRowOrThrow(orderId: string): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  return order;
}

export async function cancelOrder(
  userId: string,
  orderId: string,
  reason: unknown,
): Promise<SafeOrder> {
  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    throw new ValidationError('reason must be a string');
  }

  const order = await findOwnedOrderOrThrow(userId, orderId);

  if (!CANCELLABLE_ORDER_STATUSES.includes(order.orderStatus as never)) {
    throw new ConflictError(
      `Order cannot be cancelled once it is ${order.orderStatus} - printing may have already started`,
    );
  }

  const trimmedReason = typeof reason === 'string' ? reason.trim() || null : null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { orderId },
      data: {
        orderStatus: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: trimmedReason,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'CANCELLED',
        changedByUserId: userId,
        notes: trimmedReason ?? 'Cancelled by student',
      },
    });

    // Phase 7: a QUEUED order has a Queue row (WAITING - an order can never
    // be cancelled once PRINTING, so it can never be anything else here).
    // Cancelling the order must also cancel its place in line, not leave a
    // stale WAITING entry that start-next could still pick up.
    await tx.queue.updateMany({
      where: { orderId, queueStatus: 'WAITING' },
      data: { queueStatus: 'CANCELLED', cancelledAt: new Date() },
    });

    return tx.order.findUniqueOrThrow({ where: { orderId }, include: ORDER_INCLUDE });
  });

  return toSafeOrder(updated);
}
