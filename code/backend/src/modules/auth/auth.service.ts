import bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middleware/auth';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../lib/errors';

const SALT_ROUNDS = 12;

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export async function registerStudent(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: UserRole.STUDENT,
    },
  });

  return issueSession(user.userId, user.role, user.shopId);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new UnauthorizedError('Invalid email or password');
  if (user.status !== UserStatus.ACTIVE) throw new ForbiddenError('This account is not active');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  return issueSession(user.userId, user.role, user.shopId);
}

function issueSession(userId: number, role: UserRole, shopId: number | null) {
  const token = signToken({ userId, role, shopId });
  return { token, user: { userId, role, shopId } };
}
