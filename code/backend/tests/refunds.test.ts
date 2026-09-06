import fsSync from 'node:fs';
import path from 'node:path';

import { PrintShop } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/password';

const app = createApp();

const TEST_EMAIL_PREFIX = 'refundtest.';
const STUDENT_DOMAIN = env.allowedStudentEmailDomain;
const VALID_PASSWORD = 'CorrectHorse123';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEST_SHOP_PREFIX = 'REFTEST-';

let uniqueCounter = 0;
function unique(label: string): string {
  uniqueCounter += 1;
  return `${label}.${Date.now()}.${uniqueCounter}`;
}
function studentEmail(label: string): string {
  return `${TEST_EMAIL_PREFIX}${unique(label)}@${STUDENT_DOMAIN}`;
}

async function registerStudent(label: string): Promise<{ userId: string; token: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Refund Test ${label}`, email: studentEmail(label), password: VALID_PASSWORD });
  expect(res.status).toBe(201);
  return { userId: res.body.data.user.userId, token: res.body.data.token };
}

function signToken(userId: string, role: 'ADMIN' | 'SHOP_STAFF'): string {
  return jwt.sign({ userId, role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

async function createUserWithRole(
  label: string,
  role: 'ADMIN' | 'SHOP_STAFF',
): Promise<{ userId: string; token: string }> {
  const user = await prisma.user.create({
    data: {
      name: `Refund Test ${label}`,
      email: `${TEST_EMAIL_PREFIX}${unique(label)}@gmail.com`,
      passwordHash: await hashPassword(VALID_PASSWORD),
      role,
      status: 'ACTIVE',
    },
  });
  return { userId: user.userId, token: signToken(user.userId, role) };
}

async function uploadDocument(token: string): Promise<{ documentId: string }> {
  const buffer = fsSync.readFileSync(path.join(FIXTURES_DIR, 'valid.pdf'));
  const res = await request(app)
    .post('/api/documents')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, { filename: 'valid.pdf', contentType: 'application/pdf' });
  expect(res.status).toBe(201);
  return { documentId: res.body.data.document.documentId };
}

async function createTestShop(): Promise<PrintShop> {
  return prisma.printShop.create({
    data: {
      shopCode: `${TEST_SHOP_PREFIX}${unique('shop')}`,
      shopName: 'Refund Test Print Shop',
      location: 'Test Location',
      contact: '9000000000',
      isActive: true,
      acceptingOrders: true,
    },
  });
}

const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

let shop: PrintShop;
let admin: { userId: string; token: string };
const createdShopIds: string[] = [];

beforeAll(async () => {
  shop = await createTestShop();
  createdShopIds.push(shop.shopId);
  await prisma.shopPricingRule.create({
    data: {
      shopId: shop.shopId,
      printType: 'BW',
      paperSize: 'A4',
      sides: 'SINGLE',
      pricePerPage: 2.0,
      effectiveFrom: past,
    },
  });
  admin = await createUserWithRole('admin', 'ADMIN');
});

afterAll(async () => {
  await prisma.refund.deleteMany({ where: { payment: { order: { shopId: { in: createdShopIds } } } } });
  await prisma.payment.deleteMany({ where: { order: { shopId: { in: createdShopIds } } } });
  await prisma.order.deleteMany({ where: { shopId: { in: createdShopIds } } });
  await prisma.shopPricingRule.deleteMany({ where: { shopId: { in: createdShopIds } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  await prisma.printShop.deleteMany({ where: { shopId: { in: createdShopIds } } });
  await prisma.$disconnect();
});

async function createOrder(token: string): Promise<{ orderId: string; totalAmount: string }> {
  const { documentId } = await uploadDocument(token);
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      shopId: shop.shopId,
      items: [{ documentId, copies: 2, printType: 'BW', paperSize: 'A4', sides: 'SINGLE' }],
    });
  expect(res.status).toBe(201);
  return { orderId: res.body.data.order.orderId, totalAmount: res.body.data.order.totalAmount };
}

async function createPaidOrder(token: string): Promise<{ orderId: string; totalAmount: string }> {
  const { orderId, totalAmount } = await createOrder(token);
  await request(app)
    .post(`/api/orders/${orderId}/payment`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paymentMethod: 'UPI' });
  const confirmRes = await request(app)
    .post(`/api/orders/${orderId}/payment/confirm`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  expect(confirmRes.status).toBe(200);
  return { orderId, totalAmount };
}

async function createCancelledPaidOrder(
  token: string,
): Promise<{ orderId: string; totalAmount: string }> {
  const { orderId, totalAmount } = await createPaidOrder(token);
  const cancelRes = await request(app)
    .patch(`/api/orders/${orderId}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .send({ reason: 'No longer needed' });
  expect(cancelRes.status).toBe(200);
  return { orderId, totalAmount };
}

// ───────────────────────────────────────────────────────────────────────
// Refund requests
// ───────────────────────────────────────────────────────────────────────

describe('POST /api/orders/:orderId/refund - request refund', () => {
  it('allows the owner to request a refund for a cancelled, paid order, for the full payment amount', async () => {
    const student = await registerStudent('eligible');
    const { orderId, totalAmount } = await createCancelledPaidOrder(student.token);

    const res = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(201);
    expect(res.body.data.refund).toMatchObject({
      refundAmount: totalAmount,
      refundReason: 'Changed my mind',
      refundStatus: 'REQUESTED',
    });
    expect(res.body.data.refund.refundTransactionId).toEqual(expect.any(String));
  });

  it('rejects a refund request when the order was never paid (unpaid payment)', async () => {
    const student = await registerStudent('unpaid');
    const { orderId } = await createOrder(student.token);
    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(cancelRes.status).toBe(200);

    const res = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'No payment was made' });
    expect(res.status).toBe(409);
  });

  it('rejects a refund request for a failed payment', async () => {
    const student = await registerStudent('failed-payment');
    const { orderId } = await createOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });
    await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ simulateOutcome: 'FAILED' });
    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(cancelRes.status).toBe(200);

    const res = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Payment never succeeded' });
    expect(res.status).toBe(409);
  });

  it('rejects a refund request for an order that has not been cancelled', async () => {
    const student = await registerStudent('not-cancelled');
    const { orderId } = await createPaidOrder(student.token);

    const res = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'I want my money back without cancelling' });
    expect(res.status).toBe(409);
  });

  it('rejects a missing or empty reason', async () => {
    const student = await registerStudent('no-reason');
    const { orderId } = await createCancelledPaidOrder(student.token);

    const missing = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(missing.status).toBe(400);

    const empty = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: '   ' });
    expect(empty.status).toBe(400);
  });

  it('rejects a duplicate refund request for the same payment', async () => {
    const student = await registerStudent('duplicate-refund');
    const { orderId } = await createCancelledPaidOrder(student.token);

    const first = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'First request' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Second request' });
    expect(second.status).toBe(409);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/orders/00000000-0000-0000-0000-000000000000/refund')
      .send({ reason: 'test' });
    expect(res.status).toBe(401);
  });

  it("rejects a refund request for another user's order with 404", async () => {
    const owner = await registerStudent('refund-owner');
    const intruder = await registerStudent('refund-intruder');
    const { orderId } = await createCancelledPaidOrder(owner.token);

    const res = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ reason: 'Not mine' });
    expect(res.status).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Refund processing (admin)
// ───────────────────────────────────────────────────────────────────────

describe('PATCH /api/orders/:orderId/refund/process - admin processing', () => {
  it('allows an admin to process a requested refund to PROCESSED', async () => {
    const student = await registerStudent('process-success');
    const { orderId } = await createCancelledPaidOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Please refund' });

    const res = await request(app)
      .patch(`/api/orders/${orderId}/refund/process`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.refund.refundStatus).toBe('PROCESSED');
    expect(res.body.data.refund.processedAt).not.toBeNull();
  });

  it('supports simulating a failed refund settlement', async () => {
    const student = await registerStudent('process-fail');
    const { orderId } = await createCancelledPaidOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Please refund' });

    const res = await request(app)
      .patch(`/api/orders/${orderId}/refund/process`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ simulateOutcome: 'FAILED' });

    expect(res.status).toBe(200);
    expect(res.body.data.refund.refundStatus).toBe('FAILED');
  });

  it('rejects a student from processing a refund', async () => {
    const student = await registerStudent('process-forbidden-student');
    const { orderId } = await createCancelledPaidOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Please refund' });

    const res = await request(app)
      .patch(`/api/orders/${orderId}/refund/process`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('rejects a SHOP_STAFF caller from processing a refund (staff-shop linkage is deferred)', async () => {
    const staff = await createUserWithRole('staff', 'SHOP_STAFF');
    const student = await registerStudent('process-forbidden-staff');
    const { orderId } = await createCancelledPaidOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Please refund' });

    const res = await request(app)
      .patch(`/api/orders/${orderId}/refund/process`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('rejects processing an already-processed refund', async () => {
    const student = await registerStudent('process-twice');
    const { orderId } = await createCancelledPaidOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Please refund' });

    const first = await request(app)
      .patch(`/api/orders/${orderId}/refund/process`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(first.status).toBe(200);

    const second = await request(app)
      .patch(`/api/orders/${orderId}/refund/process`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(second.status).toBe(409);
  });

  it('returns 404 when there is no refund request for the order', async () => {
    const student = await registerStudent('no-refund-request');
    const { orderId } = await createCancelledPaidOrder(student.token);

    const res = await request(app)
      .patch(`/api/orders/${orderId}/refund/process`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Refund retrieval
// ───────────────────────────────────────────────────────────────────────

describe('GET /api/orders/:orderId/refund - retrieval', () => {
  it('lets the owner and an admin retrieve the refund', async () => {
    const student = await registerStudent('retrieve-both');
    const { orderId } = await createCancelledPaidOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Please refund' });

    const ownerRes = await request(app)
      .get(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(ownerRes.status).toBe(200);

    const adminRes = await request(app)
      .get(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(adminRes.status).toBe(200);
  });

  it("rejects another student retrieving someone else's refund", async () => {
    const owner = await registerStudent('retrieve-owner');
    const intruder = await registerStudent('retrieve-intruder');
    const { orderId } = await createCancelledPaidOrder(owner.token);
    await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ reason: 'Please refund' });

    const res = await request(app)
      .get(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get(
      '/api/orders/00000000-0000-0000-0000-000000000000/refund',
    );
    expect(res.status).toBe(401);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Cancellation + payment + refund integration
// ───────────────────────────────────────────────────────────────────────

describe('cancellation, payment, and refund integration', () => {
  it('a printing order cannot be cancelled, so it can never reach a refundable state', async () => {
    const student = await registerStudent('printing-order');
    const { orderId } = await createPaidOrder(student.token);

    await prisma.order.update({ where: { orderId }, data: { orderStatus: 'PRINTING' } });

    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(cancelRes.status).toBe(409);

    const refundRes = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Trying anyway' });
    expect(refundRes.status).toBe(409);
  });

  it('full PAYMENT_CONFIRMED -> QUEUED -> CANCELLED -> REQUESTED -> PROCESSED lifecycle works end to end', async () => {
    const student = await registerStudent('full-lifecycle');
    const { orderId, totalAmount } = await createPaidOrder(student.token);

    // A successful payment moves the order straight through
    // PAYMENT_CONFIRMED into QUEUED, transactionally (Phase 7) - QUEUED is
    // also still cancellable, same as PAYMENT_CONFIRMED was.
    const orderAfterPayment = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(orderAfterPayment.body.data.order.orderStatus).toBe('QUEUED');

    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Plans changed' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.order.orderStatus).toBe('CANCELLED');

    const refundRequest = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Order was cancelled' });
    expect(refundRequest.status).toBe(201);
    expect(refundRequest.body.data.refund.refundAmount).toBe(totalAmount);

    const processRes = await request(app)
      .patch(`/api/orders/${orderId}/refund/process`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(processRes.status).toBe(200);
    expect(processRes.body.data.refund.refundStatus).toBe('PROCESSED');

    // Order status itself is untouched by the refund - CANCELLED remains
    // the terminal order state (no separate OrderStatus enum value for
    // "refunded" was introduced).
    const finalOrder = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(finalOrder.body.data.order.orderStatus).toBe('CANCELLED');
  });
});
