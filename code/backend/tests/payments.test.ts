import fsSync from 'node:fs';
import path from 'node:path';

import { PrintShop } from '@prisma/client';
import request from 'supertest';

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';

const app = createApp();

const TEST_EMAIL_PREFIX = 'paymenttest.';
const STUDENT_DOMAIN = env.allowedStudentEmailDomain;
const VALID_PASSWORD = 'CorrectHorse123';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEST_SHOP_PREFIX = 'PAYTEST-';

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
    .send({ name: `Payment Test ${label}`, email: studentEmail(label), password: VALID_PASSWORD });
  expect(res.status).toBe(201);
  return { userId: res.body.data.user.userId, token: res.body.data.token };
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
      shopName: 'Payment Test Print Shop',
      location: 'Test Location',
      contact: '9000000000',
      isActive: true,
      acceptingOrders: true,
    },
  });
}

const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

let shop: PrintShop;
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

// ───────────────────────────────────────────────────────────────────────
// Payment creation
// ───────────────────────────────────────────────────────────────────────

describe('POST /api/orders/:orderId/payment - initiate payment', () => {
  it('allows the owning student to initiate a payment using the order total, ignoring any client-supplied amount', async () => {
    const student = await registerStudent('initiate');
    const { orderId, totalAmount } = await createOrder(student.token);

    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI', amount: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toMatchObject({
      orderId,
      amount: totalAmount,
      paymentMethod: 'UPI',
      paymentStatus: 'PENDING',
    });
    expect(res.body.data.payment.transactionId).toEqual(expect.any(String));
    expect(res.body.data.payment.paidAt).toBeNull();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/orders/00000000-0000-0000-0000-000000000000/payment')
      .send({ paymentMethod: 'UPI' });
    expect(res.status).toBe(401);
  });

  it("rejects payment for another user's order with 404", async () => {
    const owner = await registerStudent('owner');
    const intruder = await registerStudent('intruder');
    const { orderId } = await createOrder(owner.token);

    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ paymentMethod: 'UPI' });
    expect(res.status).toBe(404);
  });

  it('rejects payment for a nonexistent order with 404', async () => {
    const student = await registerStudent('missing-order');
    const res = await request(app)
      .post('/api/orders/00000000-0000-0000-0000-000000000000/payment')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid paymentMethod', async () => {
    const student = await registerStudent('bad-method');
    const { orderId } = await createOrder(student.token);
    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'BITCOIN' });
    expect(res.status).toBe(400);
  });

  it('rejects payment for a cancelled order', async () => {
    const student = await registerStudent('cancelled-order');
    const { orderId } = await createOrder(student.token);

    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(cancelRes.status).toBe(200);

    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });
    expect(res.status).toBe(409);
  });

  it('rejects a second payment attempt while one is already PENDING', async () => {
    const student = await registerStudent('duplicate-pending');
    const { orderId } = await createOrder(student.token);

    const first = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'CARD' });
    expect(second.status).toBe(409);
  });

  it('rejects a new payment attempt once the order is already paid', async () => {
    const student = await registerStudent('duplicate-success');
    const { orderId } = await createOrder(student.token);

    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });
    const confirmRes = await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.payment.paymentStatus).toBe('SUCCESS');

    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });
    expect(res.status).toBe(409);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Payment success
// ───────────────────────────────────────────────────────────────────────

describe('POST /api/orders/:orderId/payment/confirm - payment success', () => {
  it('confirms a payment as SUCCESS and moves the order straight through PAYMENT_CONFIRMED into QUEUED (Phase 7), recording both in status history', async () => {
    const student = await registerStudent('success-flow');
    const { orderId } = await createOrder(student.token);

    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });

    const confirmRes = await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.payment.paymentStatus).toBe('SUCCESS');
    expect(confirmRes.body.data.payment.paidAt).not.toBeNull();
    expect(confirmRes.body.data.payment.transactionId).toEqual(expect.any(String));

    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(orderRes.status).toBe(200);
    // Payment SUCCESS + queue entry are transactionally consistent (Phase
    // 7) - PAYMENT_CONFIRMED is a transient intra-transaction state that a
    // reader can never actually observe; the order is QUEUED by the time
    // the transaction commits.
    expect(orderRes.body.data.order.orderStatus).toBe('QUEUED');
    const history = orderRes.body.data.order.statusHistory;
    const statuses = history.map((event: { status: string }) => event.status);
    expect(statuses).toEqual(
      expect.arrayContaining(['PLACED', 'PAYMENT_CONFIRMED', 'QUEUED']),
    );
    expect(history[history.length - 1].status).toBe('QUEUED');
  });

  it('returns 404 when there is no pending payment to confirm', async () => {
    const student = await registerStudent('no-pending');
    const { orderId } = await createOrder(student.token);

    const res = await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('rejects confirming the same payment twice', async () => {
    const student = await registerStudent('double-confirm');
    const { orderId } = await createOrder(student.token);

    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });

    const first = await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(second.status).toBe(404);
  });

  it('rejects an invalid simulateOutcome value', async () => {
    const student = await registerStudent('bad-simulate');
    const { orderId } = await createOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });

    const res = await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ simulateOutcome: 'MAYBE' });
    expect(res.status).toBe(400);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Payment failure
// ───────────────────────────────────────────────────────────────────────

describe('POST /api/orders/:orderId/payment/confirm - payment failure', () => {
  it('confirms a payment as FAILED and leaves the order unpaid and not queue-eligible', async () => {
    const student = await registerStudent('failure-flow');
    const { orderId } = await createOrder(student.token);

    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'CARD' });

    const confirmRes = await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ simulateOutcome: 'FAILED' });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.payment.paymentStatus).toBe('FAILED');
    expect(confirmRes.body.data.payment.paidAt).toBeNull();

    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(orderRes.body.data.order.orderStatus).toBe('PLACED');
    expect(orderRes.body.data.order.orderStatus).not.toBe('PAYMENT_CONFIRMED');
  });

  it('allows a new payment attempt after a failed one, which can then succeed', async () => {
    const student = await registerStudent('retry-after-failure');
    const { orderId } = await createOrder(student.token);

    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'CARD' });
    await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ simulateOutcome: 'FAILED' });

    const retry = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });
    expect(retry.status).toBe(201);

    const confirmRes = await request(app)
      .post(`/api/orders/${orderId}/payment/confirm`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.payment.paymentStatus).toBe('SUCCESS');

    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(orderRes.body.data.order.orderStatus).toBe('QUEUED');
  });
});

// ───────────────────────────────────────────────────────────────────────
// Payment retrieval
// ───────────────────────────────────────────────────────────────────────

describe('GET /api/orders/:orderId/payment - retrieval', () => {
  it('lets the owner retrieve the latest payment for their order', async () => {
    const student = await registerStudent('retrieve-owner');
    const { orderId } = await createOrder(student.token);
    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'WALLET' });

    const res = await request(app)
      .get(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.payment.orderId).toBe(orderId);
    expect(res.body.data.payment.paymentMethod).toBe('WALLET');
  });

  it("rejects another user retrieving someone else's payment", async () => {
    const owner = await registerStudent('retrieve-owner-2');
    const intruder = await registerStudent('retrieve-intruder');
    const { orderId } = await createOrder(owner.token);
    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ paymentMethod: 'UPI' });

    const res = await request(app)
      .get(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get(
      '/api/orders/00000000-0000-0000-0000-000000000000/payment',
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when no payment has been made yet', async () => {
    const student = await registerStudent('no-payment-yet');
    const { orderId } = await createOrder(student.token);
    const res = await request(app)
      .get(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(404);
  });
});
