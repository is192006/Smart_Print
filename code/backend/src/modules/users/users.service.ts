import bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors';

const SALT_ROUNDS = 12;

const publicUserSelect = {
  userId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  shopId: true,
  createdAt: true,
} as const;

export async function listUsers(role?: UserRole) {
  return prisma.user.findMany({
    where: role ? { role } : undefined,
    select: publicUserSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export interface CreateStaffOrAdminInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: typeof UserRole.SHOP_STAFF | typeof UserRole.ADMIN;
  shopId?: number;
}

export async function createStaffOrAdmin(input: CreateStaffOrAdminInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  if (input.role === UserRole.SHOP_STAFF) {
    if (!input.shopId) throw new BadRequestError('shopId is required for SHOP_STAFF users');
    const shop = await prisma.printShop.findUnique({ where: { shopId: input.shopId } });
    if (!shop) throw new NotFoundError('Shop not found');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role,
      shopId: input.role === UserRole.SHOP_STAFF ? input.shopId : null,
    },
    select: publicUserSelect,
  });
  return user;
}

export async function setUserStatus(userId: number, status: UserStatus) {
  const user = await prisma.user.findUnique({ where: { userId } });
  if (!user) throw new NotFoundError('User not found');
  return prisma.user.update({ where: { userId }, data: { status }, select: publicUserSelect });
}

export async function reassignShopStaff(userId: number, shopId: number) {
  const user = await prisma.user.findUnique({ where: { userId } });
  if (!user) throw new NotFoundError('User not found');
  if (user.role !== UserRole.SHOP_STAFF) {
    throw new BadRequestError('Only SHOP_STAFF users can be assigned to a shop');
  }
  const shop = await prisma.printShop.findUnique({ where: { shopId } });
  if (!shop) throw new NotFoundError('Shop not found');
  return prisma.user.update({ where: { userId }, data: { shopId }, select: publicUserSelect });
}
