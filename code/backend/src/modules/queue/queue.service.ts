import { OrderStatus, QueueStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuthUser } from '../../middleware/auth';

export async function listQueue(shopId: number, status?: QueueStatus) {
  return prisma.queue.findMany({
    where: {
      order: { shopId },
      ...(status ? { queueStatus: status } : {}),
    },
    include: { order: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: [{ queueStatus: 'asc' }, { enteredAt: 'asc' }],
  });
}

/**
 * Starts printing the oldest WAITING order for a shop (strict FIFO by
 * entered_at). Uses SELECT ... FOR UPDATE SKIP LOCKED so that if two staff
 * members hit "start next" at the same moment, each safely claims a
 * different order instead of blocking on or double-processing the same row.
 */
export async function startNext(shopId: number) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ queue_id: number }[]>`
      SELECT q.queue_id
      FROM "queue" q
      JOIN "order" o ON o.order_id = q.order_id
      WHERE o.shop_id = ${shopId} AND q.queue_status = 'WAITING'
      ORDER BY q.entered_at ASC
      LIMIT 1
      FOR UPDATE OF q SKIP LOCKED
    `;

    if (rows.length === 0) {
      throw new NotFoundError('No waiting orders in the queue');
    }

    const queueId = rows[0].queue_id;
    const queue = await tx.queue.update({
      where: { queueId },
      data: { queueStatus: QueueStatus.PRINTING, startedAt: new Date() },
      include: { order: true },
    });

    await tx.order.update({ where: { orderId: queue.orderId }, data: { orderStatus: OrderStatus.PRINTING } });
    await tx.orderStatusHistory.create({
      data: { orderId: queue.orderId, status: OrderStatus.PRINTING, notes: 'Shop started printing' },
    });

    return queue;
  });
}

async function loadQueueForShop(queueId: number, shopId: number) {
  const queue = await prisma.queue.findUnique({ where: { queueId }, include: { order: true } });
  if (!queue) throw new NotFoundError('Queue entry not found');
  if (queue.order.shopId !== shopId) throw new ForbiddenError('This queue entry belongs to another shop');
  return queue;
}

export async function markReady(shopId: number, queueId: number) {
  const queue = await loadQueueForShop(queueId, shopId);
  if (queue.queueStatus !== QueueStatus.PRINTING) {
    throw new BadRequestError('Only an order currently PRINTING can be marked ready');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.queue.update({
      where: { queueId },
      data: { queueStatus: QueueStatus.COMPLETED, completedAt: new Date() },
    });
    await tx.order.update({ where: { orderId: queue.orderId }, data: { orderStatus: OrderStatus.READY } });
    await tx.orderStatusHistory.create({
      data: { orderId: queue.orderId, status: OrderStatus.READY, notes: 'Printing completed, ready for pickup' },
    });
    return updated;
  });
}

/** Cancellation is only permitted while an order is still WAITING (not yet started). */
export async function cancelQueueEntry(user: AuthUser, shopId: number, queueId: number, reason?: string) {
  const queue = await loadQueueForShop(queueId, shopId);
  if (queue.queueStatus !== QueueStatus.WAITING) {
    throw new BadRequestError('Only a WAITING order can be cancelled from the queue');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.queue.update({
      where: { queueId },
      data: { queueStatus: QueueStatus.CANCELLED, cancelledAt: new Date() },
    });
    await tx.order.update({
      where: { orderId: queue.orderId },
      data: {
        orderStatus: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason ?? 'Cancelled by shop before printing started',
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: queue.orderId,
        status: OrderStatus.CANCELLED,
        changedByUserId: user.userId,
        notes: reason ?? 'Cancelled by shop before printing started',
      },
    });
    return updated;
  });
}
