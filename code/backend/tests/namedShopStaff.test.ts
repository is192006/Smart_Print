import fsSync from 'node:fs';
import path from 'node:path';

import request from 'supertest';

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';

const app = createApp();

// Exercises the actual dev seed (prisma/seed.ts): three real, named shops
// and one SHOP_STAFF account per shop, logged in through the real
// /api/auth/login endpoint - not synthetic test fixtures. This is the
// automated equivalent of the manual "log in as staff@smartprint.dev /
// cse.staff@smartprint.dev / cos.staff@smartprint.dev and verify isolation"
// walkthrough. Requires the seed to have been run against the test database
// (`npx prisma db seed`) - if it hasn't, every test in this file is skipped
// rather than failing noisily.
const DEV_PASSWORD = 'DevPassword123!';
const TEST_EMAIL_PREFIX = 'namedshoptest.';
const STUDENT_DOMAIN = env.allowedStudentEmailDomain;
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

let uniqueCounter = 0;
function studentEmail(label: string): string {
  uniqueCounter += 1;
  return `${TEST_EMAIL_PREFIX}${label}.${Date.now()}.${uniqueCounter}@${STUDENT_DOMAIN}`;
}

async function login(email: string, password = DEV_PASSWORD): Promise<{ userId: string; token: string; shopId: string | null }> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return {
    userId: res.body.data.user.userId,
    token: res.body.data.token,
    shopId: res.body.data.user.shopId,
  };
}

async function registerStudent(label: string): Promise<{ userId: string; token: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Named Shop Test ${label}`, email: studentEmail(label), password: 'CorrectHorse123' });
  expect(res.status).toBe(201);
  return { userId: res.body.data.user.userId, token: res.body.data.token };
}

async function uploadDocument(token: string, filename = 'valid.pdf'): Promise<{ documentId: string }> {
  const buffer = fsSync.readFileSync(path.join(FIXTURES_DIR, 'valid.pdf'));
  const res = await request(app)
    .post('/api/documents')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, { filename, contentType: 'application/pdf' });
  expect(res.status).toBe(201);
  return { documentId: res.body.data.document.documentId };
}

const seededShopByCode: Record<string, { shopId: string; shopCode: string; shopName: string }> = {};
let seedPresent = false;
let admin: { userId: string; token: string; shopId: string | null } | null = null;
let gStaff: { userId: string; token: string; shopId: string | null } | null = null;
let cseStaff: { userId: string; token: string; shopId: string | null } | null = null;
let cosStaff: { userId: string; token: string; shopId: string | null } | null = null;

const createdOrderIds: string[] = [];

beforeAll(async () => {
  const shops = await prisma.printShop.findMany({
    where: { shopCode: { in: ['G_BLOCK', 'CSE_FACULTY', 'COS'] } },
  });
  for (const shop of shops) {
    seededShopByCode[shop.shopCode] = shop;
  }
  const staffAccounts = await prisma.user.count({
    where: {
      role: 'SHOP_STAFF',
      email: { in: ['staff@smartprint.dev', 'cse.staff@smartprint.dev', 'cos.staff@smartprint.dev'] },
    },
  });
  seedPresent = shops.length === 3 && staffAccounts === 3;

  if (!seedPresent) return;

  admin = await login('admin@smartprint.dev');
  gStaff = await login('staff@smartprint.dev');
  cseStaff = await login('cse.staff@smartprint.dev');
  cosStaff = await login('cos.staff@smartprint.dev');
});

afterAll(async () => {
  // Only ever remove data this test file itself created (test-prefixed
  // students/orders/documents). The seeded shops, pricing/finishing rules,
  // and staff/admin accounts are persistent dev fixtures and must survive.
  if (createdOrderIds.length > 0) {
    await prisma.queue.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderDocument.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  }
  await prisma.document.deleteMany({ where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  await prisma.$disconnect();
});

async function createOrderForShop(studentToken: string, shopCode: string): Promise<{ orderId: string; documentId: string }> {
  const shop = seededShopByCode[shopCode]!;
  const { documentId } = await uploadDocument(studentToken);
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      shopId: shop.shopId,
      items: [{ documentId, copies: 1, printType: 'BW', paperSize: 'A4', sides: 'SINGLE' }],
    });
  expect(res.status).toBe(201);
  createdOrderIds.push(res.body.data.order.orderId);
  return { orderId: res.body.data.order.orderId, documentId };
}

describe('named shop staff (real dev seed: G_BLOCK / CSE_FACULTY / COS)', () => {
  it('seed produced exactly 3 shops and 3 correctly-mapped staff accounts', () => {
    if (!seedPresent) {
      // eslint-disable-next-line no-console
      console.warn('Skipping: dev seed not present in this database. Run `npx prisma db seed` first.');
      return;
    }
    expect(Object.keys(seededShopByCode).sort()).toEqual(['COS', 'CSE_FACULTY', 'G_BLOCK']);
    expect(gStaff!.shopId).toBe(seededShopByCode.G_BLOCK!.shopId);
    expect(cseStaff!.shopId).toBe(seededShopByCode.CSE_FACULTY!.shopId);
    expect(cosStaff!.shopId).toBe(seededShopByCode.COS!.shopId);
  });

  it('GET /api/auth/me returns each staff member\'s own shopId, never a default/fallback shop', async () => {
    if (!seedPresent) return;
    const meG = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${gStaff!.token}`);
    expect(meG.body.data.user.shopId).toBe(seededShopByCode.G_BLOCK!.shopId);

    const meCse = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${cseStaff!.token}`);
    expect(meCse.body.data.user.shopId).toBe(seededShopByCode.CSE_FACULTY!.shopId);

    const meCos = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${cosStaff!.token}`);
    expect(meCos.body.data.user.shopId).toBe(seededShopByCode.COS!.shopId);
  });

  it('each staff member can only read their own shop queue; admin reads all three', async () => {
    if (!seedPresent) return;
    const { G_BLOCK, CSE_FACULTY, COS } = seededShopByCode;

    const gOwn = await request(app).get(`/api/shops/${G_BLOCK!.shopId}/queue`).set('Authorization', `Bearer ${gStaff!.token}`);
    expect(gOwn.status).toBe(200);
    const gToCse = await request(app).get(`/api/shops/${CSE_FACULTY!.shopId}/queue`).set('Authorization', `Bearer ${gStaff!.token}`);
    expect(gToCse.status).toBe(403);
    const gToCos = await request(app).get(`/api/shops/${COS!.shopId}/queue`).set('Authorization', `Bearer ${gStaff!.token}`);
    expect(gToCos.status).toBe(403);

    const cseOwn = await request(app).get(`/api/shops/${CSE_FACULTY!.shopId}/queue`).set('Authorization', `Bearer ${cseStaff!.token}`);
    expect(cseOwn.status).toBe(200);
    const cseToG = await request(app).get(`/api/shops/${G_BLOCK!.shopId}/queue`).set('Authorization', `Bearer ${cseStaff!.token}`);
    expect(cseToG.status).toBe(403);
    const cseToCos = await request(app).get(`/api/shops/${COS!.shopId}/queue`).set('Authorization', `Bearer ${cseStaff!.token}`);
    expect(cseToCos.status).toBe(403);

    const cosOwn = await request(app).get(`/api/shops/${COS!.shopId}/queue`).set('Authorization', `Bearer ${cosStaff!.token}`);
    expect(cosOwn.status).toBe(200);
    const cosToG = await request(app).get(`/api/shops/${G_BLOCK!.shopId}/queue`).set('Authorization', `Bearer ${cosStaff!.token}`);
    expect(cosToG.status).toBe(403);
    const cosToCse = await request(app).get(`/api/shops/${CSE_FACULTY!.shopId}/queue`).set('Authorization', `Bearer ${cosStaff!.token}`);
    expect(cosToCse.status).toBe(403);

    for (const shop of [G_BLOCK, CSE_FACULTY, COS]) {
      const adminRes = await request(app).get(`/api/shops/${shop!.shopId}/queue`).set('Authorization', `Bearer ${admin!.token}`);
      expect(adminRes.status).toBe(200);
    }
  });

  it('each staff member can only manage their own shop pricing/finishing rules', async () => {
    if (!seedPresent) return;
    const { G_BLOCK, CSE_FACULTY } = seededShopByCode;

    const ownPricing = await request(app)
      .get(`/api/shops/${G_BLOCK!.shopId}/pricing-rules`)
      .set('Authorization', `Bearer ${gStaff!.token}`);
    expect(ownPricing.status).toBe(200);

    const crossPricing = await request(app)
      .get(`/api/shops/${CSE_FACULTY!.shopId}/pricing-rules?status=all`)
      .set('Authorization', `Bearer ${gStaff!.token}`);
    expect(crossPricing.status).toBe(403);

    const crossFinishingCreate = await request(app)
      .post(`/api/shops/${CSE_FACULTY!.shopId}/finishing-rules`)
      .set('Authorization', `Bearer ${gStaff!.token}`)
      .send({ finishingType: 'STAPLING', price: 5 });
    expect(crossFinishingCreate.status).toBe(403);
  });

  it('a real G_BLOCK order: only G_BLOCK staff (and admin) can view/download/see it - CSE and COS staff are denied', async () => {
    if (!seedPresent) return;
    const student = await registerStudent('gblock-real');
    const { orderId, documentId } = await createOrderForShop(student.token, 'G_BLOCK');

    const gOrderRes = await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${gStaff!.token}`);
    expect(gOrderRes.status).toBe(200);
    const gDownload = await request(app).get(`/api/documents/${documentId}/download`).set('Authorization', `Bearer ${gStaff!.token}`);
    expect(gDownload.status).toBe(200);
    const gView = await request(app).get(`/api/documents/${documentId}/view`).set('Authorization', `Bearer ${gStaff!.token}`);
    expect(gView.status).toBe(200);
    expect(gView.headers['content-disposition']).toMatch(/inline/);

    const cseOrderRes = await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${cseStaff!.token}`);
    expect(cseOrderRes.status).toBe(403);
    const cseDownload = await request(app).get(`/api/documents/${documentId}/download`).set('Authorization', `Bearer ${cseStaff!.token}`);
    expect(cseDownload.status).toBe(404);
    const cseView = await request(app).get(`/api/documents/${documentId}/view`).set('Authorization', `Bearer ${cseStaff!.token}`);
    expect(cseView.status).toBe(404);

    const cosOrderRes = await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${cosStaff!.token}`);
    expect(cosOrderRes.status).toBe(403);
    const cosDownload = await request(app).get(`/api/documents/${documentId}/download`).set('Authorization', `Bearer ${cosStaff!.token}`);
    expect(cosDownload.status).toBe(404);
    const cosView = await request(app).get(`/api/documents/${documentId}/view`).set('Authorization', `Bearer ${cosStaff!.token}`);
    expect(cosView.status).toBe(404);

    const adminDownload = await request(app).get(`/api/documents/${documentId}/download`).set('Authorization', `Bearer ${admin!.token}`);
    expect(adminDownload.status).toBe(200);
    const adminView = await request(app).get(`/api/documents/${documentId}/view`).set('Authorization', `Bearer ${admin!.token}`);
    expect(adminView.status).toBe(200);
  });

  it('a real multi-document CSE_FACULTY order (as faculty): only CSE staff (and admin) can access every document', async () => {
    if (!seedPresent) return;
    const facultyLogin = await login('faculty@smartprint.dev');
    const docA = await uploadDocument(facultyLogin.token);
    const docB = await uploadDocument(facultyLogin.token);
    const docC = await uploadDocument(facultyLogin.token);

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${facultyLogin.token}`)
      .send({
        shopId: seededShopByCode.CSE_FACULTY!.shopId,
        items: [
          { documentId: docA.documentId, copies: 1, printType: 'BW', paperSize: 'A4', sides: 'SINGLE' },
          { documentId: docB.documentId, copies: 1, printType: 'BW', paperSize: 'A4', sides: 'SINGLE' },
          { documentId: docC.documentId, copies: 1, printType: 'BW', paperSize: 'A4', sides: 'SINGLE' },
        ],
      });
    expect(orderRes.status).toBe(201);
    createdOrderIds.push(orderRes.body.data.order.orderId);
    const documentIds = [docA.documentId, docB.documentId, docC.documentId];

    for (const documentId of documentIds) {
      const cseDownload = await request(app).get(`/api/documents/${documentId}/download`).set('Authorization', `Bearer ${cseStaff!.token}`);
      expect(cseDownload.status).toBe(200);

      const gDownload = await request(app).get(`/api/documents/${documentId}/download`).set('Authorization', `Bearer ${gStaff!.token}`);
      expect(gDownload.status).toBe(404);

      const cosDownload = await request(app).get(`/api/documents/${documentId}/download`).set('Authorization', `Bearer ${cosStaff!.token}`);
      expect(cosDownload.status).toBe(404);
    }
  });

  it('manipulating shopId/orderId/documentId in the URL cannot bypass isolation, and no storageKey/path ever leaks', async () => {
    if (!seedPresent) return;
    const student = await registerStudent('manipulate-real');
    const { orderId, documentId } = await createOrderForShop(student.token, 'COS');

    // G_BLOCK staff trying every combination of a real order/document id
    // that belongs to COS, plus a real shopId belonging to a shop they
    // don't run.
    const attempts = [
      request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${gStaff!.token}`),
      request(app).get(`/api/documents/${documentId}/download`).set('Authorization', `Bearer ${gStaff!.token}`),
      request(app).get(`/api/documents/${documentId}/view`).set('Authorization', `Bearer ${gStaff!.token}`),
      request(app).get(`/api/shops/${seededShopByCode.COS!.shopId}/queue`).set('Authorization', `Bearer ${gStaff!.token}`),
      request(app).get(`/api/orders/${orderId}/payment`).set('Authorization', `Bearer ${gStaff!.token}`),
    ];
    const results = await Promise.all(attempts);
    for (const res of results) {
      expect([403, 404]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toMatch(/storageKey/i);
      expect(JSON.stringify(res.body)).not.toContain(path.resolve(env.uploadDir));
    }
  });
});
