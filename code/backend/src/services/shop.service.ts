import { PrintShop, UserRole } from '@prisma/client';

import { prisma } from '../config/prisma';
import { CreateShopInput, SafeShop, UpdateShopInput } from '../types/shop.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

export async function getShopOrThrow(shopId: string): Promise<PrintShop> {
  const shop = await prisma.printShop.findUnique({ where: { shopId } });
  if (!shop) {
    throw new NotFoundError('Print shop not found');
  }
  return shop;
}

export async function assertShopAcceptsOrders(shopId: string): Promise<PrintShop> {
  const shop = await getShopOrThrow(shopId);
  if (!shop.isActive || !shop.acceptingOrders) {
    throw new ValidationError('This print shop is not currently accepting orders');
  }
  return shop;
}

// The CSE Department Faculty Printer is a faculty-only entitlement, not a
// general-purpose shop - see assertShopEligibleForRole/isFreeFacultyShop
// below. Identified by shopCode (stable, seeded identity) rather than name.
const FACULTY_ONLY_SHOP_CODE = 'CSE_FACULTY';

// STUDENT accounts may never place an order at the faculty-only printer.
// Every other (role, shop) combination is unrestricted here - this is a
// single, narrow carve-out, not a general shop-eligibility system. Called
// from both order creation and the pricing preview so a student is blocked
// at preview time too, not just at the final create step.
export function assertShopEligibleForRole(shop: PrintShop, role: UserRole): void {
  if (shop.shopCode === FACULTY_ONLY_SHOP_CODE && role === 'STUDENT') {
    throw new ForbiddenError('The CSE Department Faculty Printer is reserved for faculty accounts');
  }
}

// Only this exact (role, shop) combination is free - FACULTY printing at
// G_BLOCK or COS still follows normal payment rules. Never infer "free" from
// role alone.
export function isFreeFacultyShop(shop: PrintShop, role: UserRole): boolean {
  return role === 'FACULTY' && shop.shopCode === FACULTY_ONLY_SHOP_CODE;
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 8: shop-scoped authorization. Reusable by any shop-scoped
// service/route (currently queue.service.ts) so this logic exists in
// exactly one place.
//
//   ADMIN       -> any shop
//   SHOP_STAFF  -> only the shop referenced by their OWN User.shopId, and
//                  only while their account is ACTIVE
//   STUDENT     -> never
//
// Never trust a client-supplied shopId as proof of staff assignment - the
// assignment is re-derived from the database on every call, keyed off the
// authenticated userId from the JWT, never from the request body/URL.
// ─────────────────────────────────────────────────────────────────────────
export async function assertShopAccess(
  userId: string,
  role: UserRole,
  shopId: string,
): Promise<PrintShop> {
  const shop = await getShopOrThrow(shopId);

  if (role === 'ADMIN') {
    return shop;
  }

  if (role !== 'SHOP_STAFF') {
    throw new ForbiddenError('Only shop staff or administrators may perform this action');
  }

  const staffUser = await prisma.user.findUnique({ where: { userId } });
  if (!staffUser || staffUser.status !== 'ACTIVE') {
    throw new ForbiddenError('Your staff account is inactive');
  }
  if (staffUser.shopId !== shopId) {
    throw new ForbiddenError('You are not authorized to manage this shop');
  }

  return shop;
}

// ─────────────────────────────────────────────────────────────────────────
// Shop CRUD (ADMIN-gated at the route level for create/update)
// ─────────────────────────────────────────────────────────────────────────

function assertValidRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`);
  }
  if (value.trim().length > maxLength) {
    throw new ValidationError(`${fieldName} may not exceed ${maxLength} characters`);
  }
}

function assertValidBoolean(value: unknown, fieldName: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${fieldName} must be a boolean`);
  }
}

function toSafeShop(shop: PrintShop): SafeShop {
  return {
    shopId: shop.shopId,
    shopCode: shop.shopCode,
    shopName: shop.shopName,
    location: shop.location,
    contact: shop.contact,
    isActive: shop.isActive,
    acceptingOrders: shop.acceptingOrders,
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt,
  };
}

export async function createShop(input: CreateShopInput): Promise<SafeShop> {
  assertValidRequiredString(input.shopCode, 'shopCode', 50);
  assertValidRequiredString(input.shopName, 'shopName', 150);
  assertValidRequiredString(input.location, 'location', 200);
  assertValidRequiredString(input.contact, 'contact', 50);

  if (input.isActive !== undefined) {
    assertValidBoolean(input.isActive, 'isActive');
  }
  if (input.acceptingOrders !== undefined) {
    assertValidBoolean(input.acceptingOrders, 'acceptingOrders');
  }

  const shopCode = input.shopCode.trim();

  const existing = await prisma.printShop.findUnique({ where: { shopCode } });
  if (existing) {
    throw new ConflictError(`A shop with shopCode "${shopCode}" already exists`);
  }

  const shop = await prisma.printShop.create({
    data: {
      shopCode,
      shopName: input.shopName.trim(),
      location: input.location.trim(),
      contact: input.contact.trim(),
      isActive: input.isActive as boolean | undefined,
      acceptingOrders: input.acceptingOrders as boolean | undefined,
    },
  });

  return toSafeShop(shop);
}

export async function listShops(): Promise<SafeShop[]> {
  const shops = await prisma.printShop.findMany({ orderBy: { shopName: 'asc' } });
  return shops.map(toSafeShop);
}

export async function getShopSafe(shopId: string): Promise<SafeShop> {
  const shop = await getShopOrThrow(shopId);
  return toSafeShop(shop);
}

// shopCode/shopId are never accepted here - a shop's identity is
// immutable once created. Only operational fields are updatable.
//
// requester is required so this can be called by both ADMIN (unrestricted)
// and SHOP_STAFF (their own assigned, ACTIVE shop only, and restricted to
// the single operational field `acceptingOrders` - shopName/location/
// contact/isActive stay ADMIN-only, matching "Shop Operation Status" in the
// spec). assertShopAccess re-derives the staff member's shop assignment
// from the database, never trusting :shopId as proof of ownership.
export async function updateShop(
  shopId: string,
  input: UpdateShopInput,
  requester: { userId: string; role: UserRole },
): Promise<SafeShop> {
  await assertShopAccess(requester.userId, requester.role, shopId);

  if (requester.role === 'SHOP_STAFF') {
    const disallowed = (['shopName', 'location', 'contact', 'isActive'] as const).filter(
      (field) => input[field] !== undefined,
    );
    if (disallowed.length > 0) {
      throw new ForbiddenError(
        `Shop staff may only change acceptingOrders (not ${disallowed.join(', ')})`,
      );
    }
  }

  const data: {
    shopName?: string;
    location?: string;
    contact?: string;
    isActive?: boolean;
    acceptingOrders?: boolean;
  } = {};

  if (input.shopName !== undefined) {
    assertValidRequiredString(input.shopName, 'shopName', 150);
    data.shopName = input.shopName.trim();
  }
  if (input.location !== undefined) {
    assertValidRequiredString(input.location, 'location', 200);
    data.location = input.location.trim();
  }
  if (input.contact !== undefined) {
    assertValidRequiredString(input.contact, 'contact', 50);
    data.contact = input.contact.trim();
  }
  if (input.isActive !== undefined) {
    assertValidBoolean(input.isActive, 'isActive');
    data.isActive = input.isActive;
  }
  if (input.acceptingOrders !== undefined) {
    assertValidBoolean(input.acceptingOrders, 'acceptingOrders');
    data.acceptingOrders = input.acceptingOrders;
  }

  const updated = await prisma.printShop.update({ where: { shopId }, data });
  return toSafeShop(updated);
}
