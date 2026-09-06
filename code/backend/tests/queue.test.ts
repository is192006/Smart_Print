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

const TEST_EMAIL_PREFIX = 'queuetest.';
const STUDENT_DOMAIN = env.allowedStudentEmailDomain;
const VALID_PASSWORD = 'CorrectHorse123';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEST_SHOP_PREFIX = 'QUEUETEST-';

let uniqueCounter = 0;
function unique(label: string): string {
  uniqueCounter += 1;
  return `${label}.${Date.now()}.${uniqueCounter}`;
}
function studentEmail(label: string): string {
  return `${TEST_EMAIL_PREFIX}${unique(label)}@${STUDENT_DOMAIN}`;
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerStudent(label: string): Promise<{ userId: string; token: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Queue Test ${label}`, email: studentEmail(label), password: VALID_PASSWORD });
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
      name: `Queue Test ${label}`,
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

const createdShopIds: string[] = [];

async function createTestShop(label: string): Promise<PrintShop> {
  const shop = await prisma.printShop.create({
    data: {
      shopCode: `${TEST_SHOP_PREFIX}${unique(label)}`,
      shopName: `Queue Test Print Shop ${label}`,
      location: 'Test Location',
      contact: '9000000000',
      isActive: true,
      acceptingOrders: true,
    },
  });
  createdShopIds.push(shop.shopId);
  await prisma.shopPricingRule.create({
    data: {
      shopId: shop.shopId,
      printType: 'BW',
      paperSize: 'A4',
      sides: 'SINGLE',
      pricePerPage: 2.0,
      effectiveFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
  return shop;
}

let shopA: PrintShop;
let shopB: PrintShop;
let admin: { userId: string; token: string };
let staff: { userId: string; token: string };

beforeAll(async () => {
  // shopA/shopB are shared ONLY by tests that never call start-next (which
  // leaves a shop "busy" with a PRINTING order until explicitly completed)
  // - every test that starts printing creates its own fresh shop instead,
  // so no test's leftover PRINTING state can affect another test's result.
  shopA = await createTestShop('A');
  shopB = await createTestShop('B');
  admin = await createUserWithRole('admin', 'ADMIN');
  staff = await createUserWithRole('staff', 'SHOP_STAFF');
});

afterAll(async () => {
  await prisma.queue.deleteMany({ where: { order: { shopId: { in: createdShopIds } } } });
  await prisma.refund.deleteMany({ where: { payment: { order: { shopId: { in: createdShopIds } } } } });
  await prisma.payment.deleteMany({ where: { order: { shopId: { in: createdShopIds } } } });
  await prisma.order.deleteMany({ where: { shopId: { in: createdShopIds } } });
  await prisma.shopPricingRule.deleteMany({ where: { shopId: { in: createdShopIds } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  await prisma.printShop.deleteMany({ where: { shopId: { in: createdShopIds } } });
  await prisma.$disconnect();
});

async function createOrder(
  token: string,
  shop: PrintShop,
  copies = 1,
): Promise<{ orderId: string; totalAmount: string }> {
  const { documentId } = await uploadDocument(token);
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      shopId: shop.shopId,
      items: [{ documentId, copies, printType: 'BW', paperSize: 'A4', sides: 'SINGLE' }],
    });
  expect(res.status).toBe(201);
  return { orderId: res.body.data.order.orderId, totalAmount: res.body.data.order.totalAmount };
}

async function payOrder(token: string, orderId: string, simulateOutcome?: 'SUCCESS' | 'FAILED') {
  await request(app)
    .post(`/api/orders/${orderId}/payment`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paymentMethod: 'UPI' });
  return request(app)
    .post(`/api/orders/${orderId}/payment/confirm`)
    .set('Authorization', `Bearer ${token}`)
    .send(simulateOutcome ? { simulateOutcome } : {});
}

async function createQueuedOrder(
  token: string,
  shop: PrintShop,
  copies = 1,
): Promise<{ orderId: string; totalAmount: string }> {
  const { orderId, totalAmount } = await createOrder(token, shop, copies);
  const confirmRes = await payOrder(token, orderId, 'SUCCESS');
  expect(confirmRes.status).toBe(200);
  return { orderId, totalAmount };
}

// ───────────────────────────────────────────────────────────────────────
// Queue creation (payment -> queue integration) - read-only against
// shopA, safe to share.
// ───────────────────────────────────────────────────────────────────────

describe('queue creation via payment confirmation', () => {
  it('a successful payment creates a WAITING queue entry and moves the order to QUEUED', async () => {
    const student = await registerStudent('create-success');
    const { orderId } = await createQueuedOrder(student.token, shopA);

    const res = await request(app)
      .get(`/api/orders/${orderId}/queue`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.queue).toMatchObject({
      orderId,
      shopId: shopA.shopId,
      queueStatus: 'WAITING',
    });
    expect(res.body.data.queue.queueNumber).toEqual(expect.any(Number));
    expect(res.body.data.queue.enteredAt).toEqual(expect.any(String));

    const queueRowCount = await prisma.queue.count({ where: { orderId } });
    expect(queueRowCount).toBe(1);
  });

  it('a failed payment does not create a queue entry', async () => {
    const student = await registerStudent('create-failed');
    const { orderId } = await createOrder(student.token, shopA);
    const confirmRes = await payOrder(student.token, orderId, 'FAILED');
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.payment.paymentStatus).toBe('FAILED');

    const res = await request(app)
      .get(`/api/orders/${orderId}/queue`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(404);
  });

  it('a pending (unconfirmed) payment does not create a queue entry', async () => {
    const student = await registerStudent('create-pending');
    const { orderId } = await createOrder(student.token, shopA);
    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ paymentMethod: 'UPI' });

    const res = await request(app)
      .get(`/api/orders/${orderId}/queue`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────────────
// FIFO ordering - list-only against shopA, safe to share.
// ───────────────────────────────────────────────────────────────────────

describe('FIFO ordering', () => {
  it('earlier enteredAt prints first regardless of page count, copies, price, or user', async () => {
    const studentA = await registerStudent('fifo-a');
    const studentB = await registerStudent('fifo-b');
    const studentC = await registerStudent('fifo-c');

    // C has the most copies (highest price, most pages) yet must still be
    // LAST, since it entered the queue last.
    const a = await createQueuedOrder(studentA.token, shopA, 1);
    await sleep(15);
    const b = await createQueuedOrder(studentB.token, shopA, 5);
    await sleep(15);
    const c = await createQueuedOrder(studentC.token, shopA, 20);

    const listRes = await request(app)
      .get(`/api/shops/${shopA.shopId}/queue`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(listRes.status).toBe(200);
    const orderIds = (listRes.body.data.queue as { orderId: string }[]).map((e) => e.orderId);
    const indexA = orderIds.indexOf(a.orderId);
    const indexB = orderIds.indexOf(b.orderId);
    const indexC = orderIds.indexOf(c.orderId);
    expect(indexA).toBeLessThan(indexB);
    expect(indexB).toBeLessThan(indexC);
  });

  it('the next endpoint returns the earliest WAITING order without mutating it', async () => {
    const student = await registerStudent('next-readonly');
    const { orderId } = await createQueuedOrder(student.token, shopA);

    const first = await request(app)
      .get(`/api/shops/${shopA.shopId}/queue/next`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .get(`/api/shops/${shopA.shopId}/queue/next`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(second.status).toBe(200);
    expect(second.body.data.next.orderId).toBe(first.body.data.next.orderId);

    const queueRes = await request(app)
      .get(`/api/orders/${orderId}/queue`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(queueRes.body.data.queue.queueStatus).toBe('WAITING');
  });
});

// ───────────────────────────────────────────────────────────────────────
// Shop isolation
// ───────────────────────────────────────────────────────────────────────

describe('shop isolation', () => {
  it("shop A's queue never includes shop B's orders and vice versa", async () => {
    const studentA = await registerStudent('isolation-a');
    const studentB = await registerStudent('isolation-b');
    const a = await createQueuedOrder(studentA.token, shopA);
    const b = await createQueuedOrder(studentB.token, shopB);

    const queueA = await request(app)
      .get(`/api/shops/${shopA.shopId}/queue`)
      .set('Authorization', `Bearer ${admin.token}`);
    const idsA = (queueA.body.data.queue as { orderId: string }[]).map((e) => e.orderId);
    expect(idsA).toContain(a.orderId);
    expect(idsA).not.toContain(b.orderId);

    const queueB = await request(app)
      .get(`/api/shops/${shopB.shopId}/queue`)
      .set('Authorization', `Bearer ${admin.token}`);
    const idsB = (queueB.body.data.queue as { orderId: string }[]).map((e) => e.orderId);
    expect(idsB).toContain(b.orderId);
    expect(idsB).not.toContain(a.orderId);
  });

  it("starting one shop's next order never selects the other shop's order", async () => {
    // Fresh shops (not shopA/shopB) - this test calls start-next and does
    // not complete the job, which would otherwise leave a shared shop
    // permanently "busy" for every later test.
    const freshA = await createTestShop('isolation-start-a');
    const freshB = await createTestShop('isolation-start-b');
    const studentA = await registerStudent('isolation-start-a');
    const studentB = await registerStudent('isolation-start-b');
    const a = await createQueuedOrder(studentA.token, freshA);
    const b = await createQueuedOrder(studentB.token, freshB);

    const startA = await request(app)
      .post(`/api/shops/${freshA.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(startA.status).toBe(200);
    expect(startA.body.data.queue.orderId).toBe(a.orderId);
    expect(startA.body.data.queue.orderId).not.toBe(b.orderId);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Start printing - every test here gets its own fresh shop, since a
// successful start-next leaves the shop "busy" (PRINTING) unless the job
// is explicitly completed afterward.
// ───────────────────────────────────────────────────────────────────────

describe('POST /api/shops/:shopId/queue/start-next', () => {
  it('starts the earliest waiting order, updates queue and order, and records history', async () => {
    const shop = await createTestShop('start-basic');
    const student = await registerStudent('start-basic');
    const { orderId } = await createQueuedOrder(student.token, shop);

    const res = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.queue.queueStatus).toBe('PRINTING');
    expect(res.body.data.queue.startedAt).not.toBeNull();

    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(orderRes.body.data.order.orderStatus).toBe('PRINTING');
    const history = orderRes.body.data.order.statusHistory;
    expect(history[history.length - 1].status).toBe('PRINTING');
  });

  it('returns 404 when there is nothing waiting', async () => {
    const shop = await createTestShop('start-empty');

    const res = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('rejects starting a second order while one is already printing at the shop', async () => {
    const shop = await createTestShop('start-busy');
    const student1 = await registerStudent('start-busy-1');
    const student2 = await registerStudent('start-busy-2');
    await createQueuedOrder(student1.token, shop);
    await createQueuedOrder(student2.token, shop);

    const first = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(second.status).toBe(409);
  });

  it('a student cannot start printing', async () => {
    const shop = await createTestShop('start-forbidden-student');
    const student = await registerStudent('start-forbidden-student');
    await createQueuedOrder(student.token, shop);

    const res = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('a SHOP_STAFF caller cannot start printing (staff-shop linkage is deferred)', async () => {
    const shop = await createTestShop('start-forbidden-staff');
    const student = await registerStudent('start-forbidden-staff');
    await createQueuedOrder(student.token, shop);

    const res = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post(`/api/shops/${shopA.shopId}/queue/start-next`).send({});
    expect(res.status).toBe(401);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Concurrency
// ───────────────────────────────────────────────────────────────────────

describe('concurrency', () => {
  it('two simultaneous start-next calls for the same shop never both succeed on the same order', async () => {
    const shop = await createTestShop('concurrency-start');
    const student1 = await registerStudent('concurrent-1');
    const student2 = await registerStudent('concurrent-2');
    const o1 = await createQueuedOrder(student1.token, shop);
    const o2 = await createQueuedOrder(student2.token, shop);

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/shops/${shop.shopId}/queue/start-next`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({}),
      request(app)
        .post(`/api/shops/${shop.shopId}/queue/start-next`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({}),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Under the single-printer-per-shop model, exactly one call wins (200)
    // and the other is rejected (409) - both winning with the SAME order,
    // or both winning at all, would be the bug this test guards against.
    expect(statuses).toEqual([200, 409]);

    const winner = res1.status === 200 ? res1 : res2;
    expect([o1.orderId, o2.orderId]).toContain(winner.body.data.queue.orderId);

    const printingCount = await prisma.queue.count({
      where: { queueStatus: 'PRINTING', order: { shopId: shop.shopId } },
    });
    expect(printingCount).toBe(1);
  });

  it('concurrent payment confirmations for the same shop never produce duplicate queue numbers', async () => {
    // shopB is never used for start-next in this file, so it's safe to
    // share here - only WAITING entries accumulate on it.
    const student1 = await registerStudent('concurrent-pay-1');
    const student2 = await registerStudent('concurrent-pay-2');
    const order1 = await createOrder(student1.token, shopB);
    const order2 = await createOrder(student2.token, shopB);
    await request(app)
      .post(`/api/orders/${order1.orderId}/payment`)
      .set('Authorization', `Bearer ${student1.token}`)
      .send({ paymentMethod: 'UPI' });
    await request(app)
      .post(`/api/orders/${order2.orderId}/payment`)
      .set('Authorization', `Bearer ${student2.token}`)
      .send({ paymentMethod: 'UPI' });

    const [confirm1, confirm2] = await Promise.all([
      request(app)
        .post(`/api/orders/${order1.orderId}/payment/confirm`)
        .set('Authorization', `Bearer ${student1.token}`)
        .send({}),
      request(app)
        .post(`/api/orders/${order2.orderId}/payment/confirm`)
        .set('Authorization', `Bearer ${student2.token}`)
        .send({}),
    ]);
    expect(confirm1.status).toBe(200);
    expect(confirm2.status).toBe(200);

    const entries = await prisma.queue.findMany({
      where: { orderId: { in: [order1.orderId, order2.orderId] } },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].queueNumber).not.toBe(entries[1].queueNumber);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Mark ready / collection - each test that starts printing gets its own
// fresh shop for the same "leaves the shop busy" reason as above.
// ───────────────────────────────────────────────────────────────────────

describe('completing printing and collection', () => {
  it('a printing order can be marked complete, moving queue to COMPLETED and order to READY, then collected', async () => {
    const shop = await createTestShop('ready-collect');
    const student = await registerStudent('ready-collect');
    const { orderId } = await createQueuedOrder(student.token, shop);

    const startRes = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(startRes.status).toBe(200);
    const queueId = startRes.body.data.queue.queueId;

    const completeRes = await request(app)
      .patch(`/api/shops/${shop.shopId}/queue/${queueId}/complete`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.queue.queueStatus).toBe('COMPLETED');
    expect(completeRes.body.data.queue.completedAt).not.toBeNull();

    const orderAfterReady = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(orderAfterReady.body.data.order.orderStatus).toBe('READY');
    const readyHistory = orderAfterReady.body.data.order.statusHistory;
    expect(readyHistory[readyHistory.length - 1].status).toBe('READY');

    const collectRes = await request(app)
      .patch(`/api/orders/${orderId}/collect`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(collectRes.status).toBe(200);

    const orderAfterCollect = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(orderAfterCollect.body.data.order.orderStatus).toBe('COLLECTED');
    const collectedHistory = orderAfterCollect.body.data.order.statusHistory;
    expect(collectedHistory[collectedHistory.length - 1].status).toBe('COLLECTED');
  });

  it('rejects collecting an order that is not READY', async () => {
    const shop = await createTestShop('collect-not-ready');
    const student = await registerStudent('collect-not-ready');
    const { orderId } = await createQueuedOrder(student.token, shop);

    const res = await request(app)
      .patch(`/api/orders/${orderId}/collect`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('rejects completing a queue entry that is not PRINTING', async () => {
    const shop = await createTestShop('complete-not-printing');
    const student = await registerStudent('complete-not-printing');
    const { orderId } = await createQueuedOrder(student.token, shop);
    const queueRes = await request(app)
      .get(`/api/orders/${orderId}/queue`)
      .set('Authorization', `Bearer ${student.token}`);
    const queueId = queueRes.body.data.queue.queueId;

    const res = await request(app)
      .patch(`/api/shops/${shop.shopId}/queue/${queueId}/complete`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('rejects completing a queue entry that belongs to a different shop', async () => {
    const shop = await createTestShop('complete-wrong-shop');
    const otherShop = await createTestShop('complete-wrong-shop-other');
    const student = await registerStudent('complete-wrong-shop');
    await createQueuedOrder(student.token, shop);

    const startRes = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(startRes.status).toBe(200);
    const queueId = startRes.body.data.queue.queueId;

    const res = await request(app)
      .patch(`/api/shops/${otherShop.shopId}/queue/${queueId}/complete`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('a student cannot mark an order complete or collect it', async () => {
    const shop = await createTestShop('complete-forbidden');
    const student = await registerStudent('complete-forbidden');
    await createQueuedOrder(student.token, shop);

    const startRes = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(startRes.status).toBe(200);

    const completeRes = await request(app)
      .patch(`/api/shops/${shop.shopId}/queue/${startRes.body.data.queue.queueId}/complete`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(completeRes.status).toBe(403);

    const collectRes = await request(app)
      .patch(`/api/orders/${startRes.body.data.queue.orderId}/collect`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({});
    expect(collectRes.status).toBe(403);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Cancellation integration
// ───────────────────────────────────────────────────────────────────────

describe('cancellation integration', () => {
  it('cancelling a queued order cancels its queue entry, and it is skipped by start-next', async () => {
    const shop = await createTestShop('cancel-int');

    const student1 = await registerStudent('cancel-int-1');
    const student2 = await registerStudent('cancel-int-2');
    const a = await createQueuedOrder(student1.token, shop);
    await sleep(15);
    const b = await createQueuedOrder(student2.token, shop);

    const cancelRes = await request(app)
      .patch(`/api/orders/${a.orderId}/cancel`)
      .set('Authorization', `Bearer ${student1.token}`)
      .send({ reason: 'Changed my mind' });
    expect(cancelRes.status).toBe(200);

    const queueRes = await request(app)
      .get(`/api/orders/${a.orderId}/queue`)
      .set('Authorization', `Bearer ${student1.token}`);
    expect(queueRes.body.data.queue.queueStatus).toBe('CANCELLED');

    const startRes = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.queue.orderId).toBe(b.orderId);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Position
// ───────────────────────────────────────────────────────────────────────

describe('queue position', () => {
  it('is derived from FIFO order and updates as entries complete or are cancelled', async () => {
    const shop = await createTestShop('position');

    const studentA = await registerStudent('position-a');
    const studentB = await registerStudent('position-b');
    const studentC = await registerStudent('position-c');

    const a = await createQueuedOrder(studentA.token, shop);
    await sleep(15);
    const b = await createQueuedOrder(studentB.token, shop);
    await sleep(15);
    const c = await createQueuedOrder(studentC.token, shop);

    async function positionOf(token: string, orderId: string): Promise<number | null> {
      const res = await request(app)
        .get(`/api/orders/${orderId}/queue-position`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      return res.body.data.position;
    }

    expect(await positionOf(studentA.token, a.orderId)).toBe(1);
    expect(await positionOf(studentB.token, b.orderId)).toBe(2);
    expect(await positionOf(studentC.token, c.orderId)).toBe(3);

    const startRes = await request(app)
      .post(`/api/shops/${shop.shopId}/queue/start-next`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.queue.orderId).toBe(a.orderId);

    expect(await positionOf(studentA.token, a.orderId)).toBe(0);
    expect(await positionOf(studentB.token, b.orderId)).toBe(1);
    expect(await positionOf(studentC.token, c.orderId)).toBe(2);

    const cancelRes = await request(app)
      .patch(`/api/orders/${b.orderId}/cancel`)
      .set('Authorization', `Bearer ${studentB.token}`)
      .send({});
    expect(cancelRes.status).toBe(200);

    expect(await positionOf(studentC.token, c.orderId)).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Security
// ───────────────────────────────────────────────────────────────────────

describe('security', () => {
  it('rejects unauthenticated requests to every queue endpoint', async () => {
    const noAuth = [
      request(app).get('/api/orders/00000000-0000-0000-0000-000000000000/queue'),
      request(app).get('/api/orders/00000000-0000-0000-0000-000000000000/queue-position'),
      request(app).patch('/api/orders/00000000-0000-0000-0000-000000000000/collect'),
      request(app).get(`/api/shops/${shopA.shopId}/queue`),
      request(app).get(`/api/shops/${shopA.shopId}/queue/next`),
      request(app).get(`/api/shops/${shopA.shopId}/queue/current`),
      request(app).post(`/api/shops/${shopA.shopId}/queue/start-next`),
      request(app).patch(`/api/shops/${shopA.shopId}/queue/00000000-0000-0000-0000-000000000000/complete`),
    ];
    const results = await Promise.all(noAuth);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
  });

  it("rejects a student viewing another student's queue entry or position", async () => {
    const owner = await registerStudent('security-owner');
    const intruder = await registerStudent('security-intruder');
    const { orderId } = await createQueuedOrder(owner.token, shopA);

    const queueRes = await request(app)
      .get(`/api/orders/${orderId}/queue`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(queueRes.status).toBe(404);

    const positionRes = await request(app)
      .get(`/api/orders/${orderId}/queue-position`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(positionRes.status).toBe(404);
  });

  it('allows an admin to view any queue entry', async () => {
    const student = await registerStudent('security-admin-view');
    const { orderId } = await createQueuedOrder(student.token, shopA);

    const res = await request(app)
      .get(`/api/orders/${orderId}/queue`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });
});
