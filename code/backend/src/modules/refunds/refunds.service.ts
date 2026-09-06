import { PaymentStatus, RefundStatus, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { paymentProvider } from '../../lib/payment';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuthUser } from '../../middleware/auth';

const OPEN_REFUND_STATUSES: RefundStatus[] = [
  RefundStatus.REQUESTED,
  RefundStatus.APPROVED,
  RefundStatus.PROCESSED,
];

async function loadPaymentWithOrder(paymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: { paymentId },
    include: { order: true },
  });
  if (!payment) throw new NotFoundError('Payment not found');
  return payment;
}

function assertCanActOnPayment(user: AuthUser, order: { userId: number; shopId: number }) {
  if (user.role === UserRole.STUDENT && order.userId !== user.userId) {
    throw new ForbiddenError('You cannot act on this payment');
  }
  if (user.role === UserRole.SHOP_STAFF && order.shopId !== user.shopId) {
    throw new ForbiddenError('You cannot act on this payment');
  }
}

/**
 * Requests a refund against a payment. Never against an order directly —
 * the order is only reachable via payment -> order. Validates that the
 * requested amount, added to any refund already REQUESTED/APPROVED/PROCESSED
 * for this payment, does not exceed the original payment amount. The payment
 * row is locked for the duration of the check to make this safe under
 * concurrent refund requests.
 */
export async function requestRefund(
  user: AuthUser,
  paymentId: number,
  refundAmount: number,
  refundReason: string,
) {
  const payment = await loadPaymentWithOrder(paymentId);
  assertCanActOnPayment(user, payment.order);

  if (payment.paymentStatus !== PaymentStatus.SUCCESS) {
    throw new BadRequestError('Only a successful payment can be refunded');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "payment" WHERE payment_id = ${paymentId} FOR UPDATE`;

    const existing = await tx.refund.findMany({
      where: { paymentId, refundStatus: { in: OPEN_REFUND_STATUSES } },
    });
    const alreadyRefunded = existing.reduce((sum, r) => sum + Number(r.refundAmount), 0);

    if (alreadyRefunded + refundAmount > Number(payment.amount)) {
      throw new BadRequestError('Refund amount would exceed the original payment amount');
    }

    return tx.refund.create({
      data: { paymentId, refundAmount, refundReason },
    });
  });
}

export async function approveRefund(user: AuthUser, refundId: number) {
  const refund = await prisma.refund.findUnique({ where: { refundId }, include: { payment: { include: { order: true } } } });
  if (!refund) throw new NotFoundError('Refund not found');
  assertCanActOnPayment(user, refund.payment.order);
  if (user.role === UserRole.STUDENT) throw new ForbiddenError('Only shop staff or admin may approve refunds');

  if (refund.refundStatus !== RefundStatus.REQUESTED) {
    throw new BadRequestError('Only a REQUESTED refund can be approved');
  }

  return prisma.refund.update({ where: { refundId }, data: { refundStatus: RefundStatus.APPROVED } });
}

export async function processRefund(user: AuthUser, refundId: number) {
  const refund = await prisma.refund.findUnique({ where: { refundId }, include: { payment: { include: { order: true } } } });
  if (!refund) throw new NotFoundError('Refund not found');
  assertCanActOnPayment(user, refund.payment.order);
  if (user.role === UserRole.STUDENT) throw new ForbiddenError('Only shop staff or admin may process refunds');

  if (refund.refundStatus !== RefundStatus.APPROVED) {
    throw new BadRequestError('Only an APPROVED refund can be processed');
  }

  const result = await paymentProvider.refund({
    transactionId: refund.payment.transactionId,
    amount: Number(refund.refundAmount),
  });

  return prisma.refund.update({
    where: { refundId },
    data: {
      refundStatus: result.success ? RefundStatus.PROCESSED : RefundStatus.FAILED,
      refundTransactionId: result.success ? result.refundTransactionId : null,
      processedAt: new Date(),
    },
  });
}

export async function listRefunds(user: AuthUser) {
  const orderScope =
    user.role === UserRole.STUDENT
      ? { userId: user.userId }
      : user.role === UserRole.SHOP_STAFF
        ? { shopId: user.shopId ?? -1 }
        : {};

  return prisma.refund.findMany({
    where: { payment: { order: orderScope } },
    include: { payment: { include: { order: true } } },
    orderBy: { requestedAt: 'desc' },
  });
}
