import request from 'supertest';

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { emailService } from '../src/services/email';
import { hashResetToken } from '../src/utils/passwordResetToken';

const app = createApp();

const TEST_EMAIL_PREFIX = 'pwreset.';
const STUDENT_DOMAIN = env.allowedStudentEmailDomain;
const VALID_PASSWORD = 'CorrectHorse123';
const NEW_PASSWORD = 'NewCorrectHorse456';

let uniqueCounter = 0;
function unique(label: string): string {
  uniqueCounter += 1;
  return `${label}.${Date.now()}.${uniqueCounter}`;
}
function studentEmail(label: string): string {
  return `${TEST_EMAIL_PREFIX}${unique(label)}@${STUDENT_DOMAIN}`;
}

async function registerStudent(label: string, email?: string): Promise<{ userId: string; email: string }> {
  const finalEmail = email ?? studentEmail(label);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Reset Test ${label}`, email: finalEmail, password: VALID_PASSWORD });
  expect(res.status).toBe(201);
  return { userId: res.body.data.user.userId, email: finalEmail };
}

async function createUserWithRole(
  label: string,
  role: 'ADMIN' | 'SHOP_STAFF' | 'FACULTY',
): Promise<{ userId: string; email: string }> {
  const { hashPassword } = await import('../src/utils/password');
  const email = `${TEST_EMAIL_PREFIX}${unique(label)}@gmail.com`;
  const user = await prisma.user.create({
    data: {
      name: `Reset Test ${label}`,
      email,
      passwordHash: await hashPassword(VALID_PASSWORD),
      role,
      status: 'ACTIVE',
    },
  });
  return { userId: user.userId, email };
}

function extractRawToken(resetUrl: string): string {
  const url = new URL(resetUrl);
  const token = url.searchParams.get('token');
  if (!token) throw new Error('resetUrl had no token param');
  return token;
}

async function requestResetAndGetRawToken(email: string): Promise<string> {
  const sendSpy = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);
  const res = await request(app).post('/api/auth/forgot-password').send({ email });
  expect(res.status).toBe(200);
  expect(sendSpy).toHaveBeenCalledTimes(1);
  const message = sendSpy.mock.calls[0]![0];
  sendSpy.mockRestore();
  const resetUrlMatch = message.text.match(/https?:\/\/\S+/);
  if (!resetUrlMatch) throw new Error('No reset URL found in email text');
  return extractRawToken(resetUrlMatch[0]);
}

async function login(email: string, password: string) {
  return request(app).post('/api/auth/login').send({ email, password });
}

afterAll(async () => {
  await prisma.passwordResetToken.deleteMany({
    where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/forgot-password', () => {
  it('1. returns generic success for an existing email', async () => {
    const student = await registerStudent('forgot-existing');
    const sendSpy = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: student.email });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
    sendSpy.mockRestore();
  });

  it('2. returns the exact same generic success for a nonexistent email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent.pwreset@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it('3. responses for an existing vs nonexistent email are byte-for-byte identical', async () => {
    const student = await registerStudent('forgot-identical');
    const sendSpy = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);

    const existingRes = await request(app).post('/api/auth/forgot-password').send({ email: student.email });
    const missingRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'still.nonexistent.pwreset@example.com' });

    expect(existingRes.status).toBe(missingRes.status);
    expect(existingRes.body).toEqual(missingRes.body);
    sendSpy.mockRestore();
  });

  it('4. email is normalized (mixed case / whitespace still matches the account)', async () => {
    const student = await registerStudent('forgot-normalize');
    const sendSpy = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: `  ${student.email.toUpperCase()}  ` });
    expect(res.status).toBe(200);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0]![0].to).toBe(student.email);
    sendSpy.mockRestore();
  });

  it('5/6/7. generates a secure random token and stores only its SHA-256 hash, never the raw token', async () => {
    const student = await registerStudent('forgot-tokenhash');
    const rawToken = await requestResetAndGetRawToken(student.email);

    expect(rawToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex-encoded

    const row = await prisma.passwordResetToken.findFirst({
      where: { user: { email: student.email } },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    expect(row!.tokenHash).toBe(hashResetToken(rawToken));
    expect(row!.tokenHash).not.toBe(rawToken);
    // The raw token must not appear anywhere in the stored row.
    expect(JSON.stringify(row)).not.toContain(rawToken);
  });

  it('22. an inactive user does not leak information: no token/email is created for them', async () => {
    const student = await registerStudent('forgot-inactive');
    await prisma.user.update({ where: { userId: student.userId }, data: { status: 'INACTIVE' } });
    const sendSpy = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: student.email });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
    expect(sendSpy).not.toHaveBeenCalled();

    const row = await prisma.passwordResetToken.findFirst({ where: { user: { email: student.email } } });
    expect(row).toBeNull();
    sendSpy.mockRestore();
  });

  it('rejects a missing/invalid email with a validation error (not a silent 200)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('never returns a token/resetUrl field in the response body', async () => {
    const student = await registerStudent('forgot-noleak');
    const sendSpy = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: student.email });
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    expect(JSON.stringify(res.body)).not.toMatch(/resetUrl/i);
    sendSpy.mockRestore();
  });
});

describe('POST /api/auth/reset-password', () => {
  it('11. rejects a missing token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('10. rejects a completely invalid/garbage token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('8/9. rejects an expired token', async () => {
    const student = await registerStudent('reset-expired');
    const rawToken = await requestResetAndGetRawToken(student.email);
    await prisma.passwordResetToken.updateMany({
      where: { user: { email: student.email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);

    const loginOld = await login(student.email, VALID_PASSWORD);
    expect(loginOld.status).toBe(200); // 20. password unchanged after a failed reset
  });

  it('18. enforces the existing password policy (same rules as registration)', async () => {
    const student = await registerStudent('reset-weakpw');
    const rawToken = await requestResetAndGetRawToken(student.email);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'short1', confirmPassword: 'short1' });
    expect(res.status).toBe(400);

    // 20. token/password remain valid and usable after a validation failure
    const loginOld = await login(student.email, VALID_PASSWORD);
    expect(loginOld.status).toBe(200);
  });

  it('19. rejects a password/confirmPassword mismatch', async () => {
    const student = await registerStudent('reset-mismatch');
    const rawToken = await requestResetAndGetRawToken(student.email);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD, confirmPassword: 'SomethingElse123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/do not match/i);
  });

  it('12/13/14. a successful reset lets the new password log in and the old password no longer works', async () => {
    const student = await registerStudent('reset-success');
    const rawToken = await requestResetAndGetRawToken(student.email);

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(resetRes.status).toBe(200);

    const newLogin = await login(student.email, NEW_PASSWORD);
    expect(newLogin.status).toBe(200);

    const oldLogin = await login(student.email, VALID_PASSWORD);
    expect(oldLogin.status).toBe(401);
  });

  it('16. the same token cannot be used twice', async () => {
    const student = await registerStudent('reset-reuse');
    const rawToken = await requestResetAndGetRawToken(student.email);

    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'AnotherPassword789', confirmPassword: 'AnotherPassword789' });
    expect(second.status).toBe(401);

    // Password from the first (successful) reset remains in effect.
    const loginRes = await login(student.email, NEW_PASSWORD);
    expect(loginRes.status).toBe(200);
  });

  it('17. requesting a new reset invalidates the previous unused token ("latest link wins")', async () => {
    const student = await registerStudent('reset-supersede');
    const firstToken = await requestResetAndGetRawToken(student.email);
    const secondToken = await requestResetAndGetRawToken(student.email);
    expect(firstToken).not.toBe(secondToken);

    const useFirst = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: firstToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(useFirst.status).toBe(401);

    const useSecond = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: secondToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(useSecond.status).toBe(200);

    const loginRes = await login(student.email, NEW_PASSWORD);
    expect(loginRes.status).toBe(200);
  });

  it('21. concurrent reset attempts with the same token are race-safe: exactly one succeeds', async () => {
    const student = await registerStudent('reset-race');
    const rawToken = await requestResetAndGetRawToken(student.email);

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'RaceWinnerA123', confirmPassword: 'RaceWinnerA123' }),
      request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'RaceWinnerB123', confirmPassword: 'RaceWinnerB123' }),
    ]);
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 401]);

    const usedCount = await prisma.passwordResetToken.count({
      where: { user: { email: student.email }, usedAt: { not: null } },
    });
    expect(usedCount).toBe(1);
  });

  it('23/24/25/26. reset works for STUDENT, FACULTY, SHOP_STAFF, and ADMIN accounts', async () => {
    const student = await registerStudent('reset-role-student');
    const faculty = await createUserWithRole('reset-role-faculty', 'FACULTY');
    const staff = await createUserWithRole('reset-role-staff', 'SHOP_STAFF');
    const admin = await createUserWithRole('reset-role-admin', 'ADMIN');

    for (const account of [student, faculty, staff, admin]) {
      const rawToken = await requestResetAndGetRawToken(account.email);
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(resetRes.status).toBe(200);

      const loginRes = await login(account.email, NEW_PASSWORD);
      expect(loginRes.status).toBe(200);
    }
  });

  it('a client-supplied userId cannot be used to reset a different account - the token alone is authoritative', async () => {
    const victim = await registerStudent('reset-victim');
    const attacker = await registerStudent('reset-attacker');
    const rawToken = await requestResetAndGetRawToken(attacker.email);

    // Attempting to smuggle a different target via extra fields does
    // nothing - the service never reads anything but `token` to find the
    // account to update.
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: rawToken,
        userId: victim.userId,
        email: victim.email,
        password: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      });
    expect(res.status).toBe(200);

    // Only the attacker's own account (owner of the token) was changed.
    const attackerLogin = await login(attacker.email, NEW_PASSWORD);
    expect(attackerLogin.status).toBe(200);
    const victimStillOld = await login(victim.email, VALID_PASSWORD);
    expect(victimStillOld.status).toBe(200);
  });
});

describe('27. production email configuration', () => {
  it('refuses to start (throws) if NODE_ENV=production and no SMTP transport is configured', () => {
    jest.resetModules();
    jest.doMock('../src/config/env', () => ({
      env: {
        nodeEnv: 'production',
        frontendUrl: 'https://smartprint.example.com',
        email: { from: 'SmartPrint <no-reply@smartprint.dev>' },
      },
    }));

    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../src/services/email');
    }).toThrow(/email is not configured/i);

    jest.dontMock('../src/config/env');
    jest.resetModules();
  });
});
