import { User } from '@prisma/client';

import { prisma } from '../config/prisma';
import * as shopService from './shop.service';
import { CreateStaffInput, SafeStaffUser, UpdateStaffInput } from '../types/staff.types';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { hashPassword, validatePasswordPolicy } from '../utils/password';
import {
  assertValidEmailFormat,
  assertValidEmailInput,
  assertValidName,
  assertValidPasswordInput,
  assertValidPhone,
  normalizeEmail,
} from '../utils/validation';

const STAFF_SHOP_SELECT = { shopId: true, shopCode: true, shopName: true } as const;

type StaffWithShop = User & {
  shop: { shopId: string; shopCode: string; shopName: string } | null;
};

function assertValidShopIdInput(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError('shopId is required');
  }
}

function assertValidStaffStatus(value: unknown): asserts value is 'ACTIVE' | 'INACTIVE' {
  if (value !== 'ACTIVE' && value !== 'INACTIVE') {
    throw new ValidationError('status must be one of: ACTIVE, INACTIVE');
  }
}

// Staff may only be assigned to a shop that exists and is active - an
// inactive/unknown shop is never a valid assignment target, whether at
// creation or reassignment.
async function assertAssignableShopId(shopId: string): Promise<void> {
  const shop = await shopService.getShopOrThrow(shopId);
  if (!shop.isActive) {
    throw new ValidationError('Staff cannot be assigned to an inactive shop');
  }
}

function toSafeStaffUser(user: StaffWithShop): SafeStaffUser {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    shop: user.shop,
  };
}

// ADMIN-only (enforced at the route level). role is always hardcoded to
// SHOP_STAFF here - the client can never request ADMIN or STUDENT through
// this endpoint, and password_hash/userId/status are never read from the
// input object (status is always ACTIVE at creation).
export async function createStaff(input: CreateStaffInput): Promise<SafeStaffUser> {
  assertValidName(input.name);
  assertValidEmailInput(input.email);
  assertValidPhone(input.phone);
  assertValidPasswordInput(input.password);
  assertValidShopIdInput(input.shopId);

  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const phone = input.phone ? input.phone.trim() : null;
  const password = input.password;
  const shopId = input.shopId.trim();

  assertValidEmailFormat(email);
  validatePasswordPolicy(password);
  await assertAssignableShopId(shopId);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      role: 'SHOP_STAFF',
      status: 'ACTIVE',
      shopId,
    },
    include: { shop: { select: STAFF_SHOP_SELECT } },
  });

  return toSafeStaffUser(user);
}

export async function listStaff(): Promise<SafeStaffUser[]> {
  const staff = await prisma.user.findMany({
    where: { role: 'SHOP_STAFF' },
    include: { shop: { select: STAFF_SHOP_SELECT } },
    orderBy: { name: 'asc' },
  });
  return staff.map(toSafeStaffUser);
}

async function getStaffUserOrThrow(staffId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { userId: staffId } });
  if (!user || user.role !== 'SHOP_STAFF') {
    throw new NotFoundError('Staff member not found');
  }
  return user;
}

// Supports name/shopId/status updates only - role is never accepted as
// input at all (not part of UpdateStaffInput), so it can never be changed
// through this endpoint. Reassignment (shopId) is a single atomic write.
export async function updateStaff(staffId: string, input: UpdateStaffInput): Promise<SafeStaffUser> {
  await getStaffUserOrThrow(staffId);

  const data: { name?: string; shopId?: string; status?: 'ACTIVE' | 'INACTIVE' } = {};

  if (input.name !== undefined) {
    assertValidName(input.name);
    data.name = input.name.trim();
  }

  if (input.shopId !== undefined) {
    assertValidShopIdInput(input.shopId);
    const shopId = input.shopId.trim();
    await assertAssignableShopId(shopId);
    data.shopId = shopId;
  }

  if (input.status !== undefined) {
    assertValidStaffStatus(input.status);
    data.status = input.status;
  }

  const updated = await prisma.user.update({
    where: { userId: staffId },
    data,
    include: { shop: { select: STAFF_SHOP_SELECT } },
  });

  return toSafeStaffUser(updated);
}
