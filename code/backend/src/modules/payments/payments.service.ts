import crypto from 'node:crypto';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { paymentProvider } from '../../lib/payment';
import { nextQueueNumber } from '../../lib/sequences';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuthUser } from '../../middleware/auth';

/**
 * Initiates (or retries) payment for an order.
 *
 * Two-phase, transaction-safe flow:
 *  1. Lock the order row, verify it is still payable, and record a PENDING
 *     payment attempt — this reservation prevents a second concurrent
 *     request from also charging the same order.
 *  2. Call the (external) payment provider *outside* the DB transaction,
 *     then, in a second transaction, record the outcome and — only on
 *     success — atomically advance the order to PAYMENT_CONFIRMED, create
 *     its QUEUE entry with a sequence-generated token, and advance it to
 *     QUEUED. Both status changes are logged to ORDER_STATUS_HISTORY.
 *
 * A payment can fail, leaving the order in CREATED so the student can retry
 * with a new payment attempt.
 */
export async function initiatePayment(user: AuthUser, orderId: number, paymentMethod: string) {
  const { order, payment } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "order" WHERE order_id = ${orderId} FOR UPDATE`;

    const order = await tx.order.findUnique({ where: { orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== user.userId) throw new ForbiddenError('You cannot pay for this order');
    if (order.orderStatus !== OrderStatus.CREATED) {
      throw new BadRequestError('This order is not awaiting payment');
    }

    const payment = await tx.payment.create({
      data: {
        orderId,
        amount: order.totalAmount,
        paymentMethod,
        transactionId: `PENDING-${crypto.randomUUID()}`,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    return { order, payment };
  });

  const chargeResult = await paymentProvider.charge({
    orderId,
    amount: Number(order.totalAmount),
    paymentMethod,
  });

  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { paymentId: payment.paymentId },
      data: {
        transactionId: chargeResult.transactionId,
        paymentStatus: chargeResult.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
        paidAt: chargeResult.success ? new Date() : null,
      },
    });

    if (!chargeResult.success) {
      return { payment: updatedPayment, queue: null };
    }

    await tx.order.update({ where: { orderId }, data: { orderStatus: OrderStatus.PAYMENT_CONFIRMED } });
    await tx.orderStatusHistory.create({
      data: { orderId, status: OrderStatus.PAYMENT_CONFIRMED, notes: 'Payment succeeded' },
    });

    const queueNumber = await nextQueueNumber(tx);
    const queue = await tx.queue.create({
      data: { orderId, queueNumber, queueStatus: 'WAITING' },
    });

    await tx.order.update({ where: { orderId }, data: { orderStatus: OrderStatus.QUEUED } });
    await tx.orderStatusHistory.create({
      data: { orderId, status: OrderStatus.QUEUED, notes: `Entered printing queue, token ${queueNumber}` },
    });

    return { payment: updatedPayment, queue };
  });
}

export async function listPaymentsForOrder(user: AuthUser, orderId: number) {
  const order = await prisma.order.findUnique({ where: { orderId } });
  if (!order) throw new NotFoundError('Order not found');

  if (user.role === UserRole.STUDENT && order.userId !== user.userId) {
    throw new ForbiddenError('You cannot access these payments');
  }
  if (user.role === UserRole.SHOP_STAFF && order.shopId !== user.shopId) {
    throw new ForbiddenError('You cannot access these payments');
  }

  return prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
}
