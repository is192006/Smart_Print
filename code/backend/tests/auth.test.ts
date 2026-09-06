import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/password';

const app = createApp();

// Every user created by this suite uses this email prefix so cleanup can
// find and remove exactly (and only) what the suite created.
const TEST_EMAIL_PREFIX = 'authtest.';
const STUDENT_DOMAIN = env.allowedStudentEmailDomain;
const VALID_PASSWORD = 'CorrectHorse123';

let uniqueCounter = 0;
function uniqueLocalPart(label: string): string {
  uniqueCounter += 1;
  return `${TEST_EMAIL_PREFIX}${label}.${Date.now()}.${uniqueCounter}`;
}

function studentEmail(label: string): string {
  return `${uniqueLocalPart(label)}@${STUDENT_DOMAIN}`;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('1. registers a student with an @<domain> email', async () => {
    const email = studentEmail('valid');
    const res = await request(app).post('/api/auth/register').send({
      name: 'Valid Student',
      email,
      phone: '9876500001',
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('STUDENT');
    expect(res.body.data.user.status).toBe('ACTIVE');
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(typeof res.body.data.token).toBe('string');
  });

  it('2. rejects registration with a Gmail address', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Gmail Student',
        email: `${uniqueLocalPart('gmail')}@gmail.com`,
        password: VALID_PASSWORD,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('3. rejects registration with another non-domain email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Yahoo Student',
        email: `${uniqueLocalPart('yahoo')}@yahoo.com`,
        password: VALID_PASSWORD,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('4. accepts an uppercase domain email after normalization', async () => {
    const email = studentEmail('upper').toUpperCase();
    const res = await request(app).post('/api/auth/register').send({
      name: 'Upper Case Student',
      email,
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(email.toLowerCase());
  });

  it('5. rejects a duplicate email', async () => {
    const email = studentEmail('dup');
    const payload = { name: 'Dup Student', email, password: VALID_PASSWORD };

    const first = await request(app).post('/api/auth/register').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/auth/register').send(payload);
    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
  });

  it('6. rejects a weak/invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Weak Password Student',
        email: studentEmail('weak'),
        password: 'short',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('17. cannot create a SHOP_STAFF account via public registration', async () => {
    const email = studentEmail('escalate-staff');
    const res = await request(app).post('/api/auth/register').send({
      name: 'Escalation Attempt',
      email,
      password: VALID_PASSWORD,
      role: 'SHOP_STAFF',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('STUDENT');
  });

  it('18. cannot create an ADMIN account via public registration', async () => {
    const email = studentEmail('escalate-admin');
    const res = await request(app).post('/api/auth/register').send({
      name: 'Escalation Attempt',
      email,
      password: VALID_PASSWORD,
      role: 'ADMIN',
      status: 'INACTIVE',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('STUDENT');
    expect(res.body.data.user.status).toBe('ACTIVE');
  });
});

describe('POST /api/auth/login', () => {
  const email = studentEmail('login');

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Student',
      email,
      password: VALID_PASSWORD,
    });
  });

  it('7. logs in successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe(email);
  });

  it('8. rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'TotallyWrong123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('9. rejects login for an inactive account', async () => {
    const inactiveEmail = studentEmail('inactive');
    await prisma.user.create({
      data: {
        name: 'Inactive Student',
        email: inactiveEmail,
        passwordHash: await hashPassword(VALID_PASSWORD),
        role: 'STUDENT',
        status: 'INACTIVE',
      },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: inactiveEmail, password: VALID_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/auth/me', () => {
  it('10. rejects a request with no token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('11. rejects an invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('12. returns the current user for a valid token', async () => {
    const email = studentEmail('me');
    const register = await request(app).post('/api/auth/register').send({
      name: 'Me Student',
      email,
      password: VALID_PASSWORD,
    });
    const token = register.body.data.token;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });
});

describe('role-based authorization', () => {
  let studentToken: string;
  let shopStaffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const studentEmailAddr = studentEmail('role-student');
    const studentRes = await request(app).post('/api/auth/register').send({
      name: 'Role Student',
      email: studentEmailAddr,
      password: VALID_PASSWORD,
    });
    studentToken = studentRes.body.data.token;

    const staffUser = await prisma.user.create({
      data: {
        name: 'Role Shop Staff',
        email: `${uniqueLocalPart('role-staff')}@gmail.com`,
        passwordHash: await hashPassword(VALID_PASSWORD),
        role: 'SHOP_STAFF',
        status: 'ACTIVE',
      },
    });
    shopStaffToken = jwt.sign({ userId: staffUser.userId, role: staffUser.role }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions);

    const adminUser = await prisma.user.create({
      data: {
        name: 'Role Admin',
        email: `${uniqueLocalPart('role-admin')}@gmail.com`,
        passwordHash: await hashPassword(VALID_PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminToken = jwt.sign({ userId: adminUser.userId, role: adminUser.role }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions);
  });

  it('13. allows a student to access a student-protected endpoint', async () => {
    const res = await request(app)
      .get('/api/test/student')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
  });

  it('14. rejects a student from an admin-only endpoint with 403', async () => {
    const res = await request(app)
      .get('/api/test/admin')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('15. rejects shop staff from an admin-only endpoint with 403', async () => {
    const res = await request(app)
      .get('/api/test/admin')
      .set('Authorization', `Bearer ${shopStaffToken}`);
    expect(res.status).toBe(403);
  });

  it('16. allows an admin to access the admin endpoint', async () => {
    const res = await request(app)
      .get('/api/test/admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/staff (admin-only shop-staff creation)', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .send({
        name: 'New Staff',
        email: `${uniqueLocalPart('unauth-staff')}@gmail.com`,
        password: VALID_PASSWORD,
      });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin (student) caller with 403', async () => {
    const studentRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Not Admin',
        email: studentEmail('not-admin'),
        password: VALID_PASSWORD,
      });

    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${studentRes.body.data.token}`)
      .send({
        name: 'New Staff',
        email: `${uniqueLocalPart('blocked-staff')}@gmail.com`,
        password: VALID_PASSWORD,
      });

    expect(res.status).toBe(403);
  });

  it('allows an admin to create a SHOP_STAFF account with a non-domain email', async () => {
    const adminUser = await prisma.user.create({
      data: {
        name: 'Creating Admin',
        email: `${uniqueLocalPart('creating-admin')}@gmail.com`,
        passwordHash: await hashPassword(VALID_PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const adminToken = jwt.sign({ userId: adminUser.userId, role: adminUser.role }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions);

    const staffEmail = `${uniqueLocalPart('new-staff')}@gmail.com`;
    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Brand New Staff', email: staffEmail, password: VALID_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('SHOP_STAFF');
    expect(res.body.data.user.email).toBe(staffEmail);
  });
});
