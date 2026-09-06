import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Fake, non-production dev password shared by every seeded account so the
// login endpoint can actually be exercised against seed data. Never use
// this outside local development.
const DEV_PASSWORD = 'DevPassword123!';
const devPasswordHash = bcrypt.hashSync(DEV_PASSWORD, 10);

// Development seed data only. All emails/phones/passwords below are fake.
// Safe to re-run: uses upsert keyed on unique fields (email / shopCode).
async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartprint.dev' },
    update: { passwordHash: devPasswordHash },
    create: {
      name: 'SmartPrint Admin',
      email: 'admin@smartprint.dev',
      phone: '9000000001',
      passwordHash: devPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  // The three real, independent printing shops (Phase 8) - each with its
  // own strictly-FIFO queue. Shops must exist before the seeded staff
  // account can be assigned to one.
  const gBlock = await prisma.printShop.upsert({
    where: { shopCode: 'G_BLOCK' },
    update: {},
    create: {
      shopCode: 'G_BLOCK',
      shopName: 'G Block Print Shop',
      location: 'G Block, Ground Floor',
      contact: '9111111111',
      isActive: true,
      acceptingOrders: true,
    },
  });

  const cseFaculty = await prisma.printShop.upsert({
    where: { shopCode: 'CSE_FACULTY' },
    update: {},
    create: {
      shopCode: 'CSE_FACULTY',
      shopName: 'CSE Department Faculty Printer',
      location: 'CSE Department, Faculty Block',
      contact: '9222222222',
      isActive: true,
      acceptingOrders: true,
    },
  });

  const cos = await prisma.printShop.upsert({
    where: { shopCode: 'COS' },
    update: {},
    create: {
      shopCode: 'COS',
      shopName: 'COS Shop',
      location: 'Central Office Services',
      contact: '9333333333',
      isActive: true,
      acceptingOrders: true,
    },
  });

  const shops = [gBlock, cseFaculty, cos];

  // One SHOP_STAFF account per real shop, each pinned to its own shopId.
  // Upserted (not created blind) so re-running the seed re-verifies/repairs
  // the shop assignment rather than creating a duplicate - see
  // staff.service.ts for how an admin reassigns staff to a different shop
  // after creation.
  const shopStaff = await prisma.user.upsert({
    where: { email: 'staff@smartprint.dev' },
    update: { passwordHash: devPasswordHash, shopId: gBlock.shopId },
    create: {
      name: 'Shop Staff One',
      email: 'staff@smartprint.dev',
      phone: '9000000002',
      passwordHash: devPasswordHash,
      role: 'SHOP_STAFF',
      status: 'ACTIVE',
      shopId: gBlock.shopId,
    },
  });

  const cseShopStaff = await prisma.user.upsert({
    where: { email: 'cse.staff@smartprint.dev' },
    update: { passwordHash: devPasswordHash, shopId: cseFaculty.shopId },
    create: {
      name: 'CSE Faculty Printer Staff',
      email: 'cse.staff@smartprint.dev',
      phone: '9000000004',
      passwordHash: devPasswordHash,
      role: 'SHOP_STAFF',
      status: 'ACTIVE',
      shopId: cseFaculty.shopId,
    },
  });

  const cosShopStaff = await prisma.user.upsert({
    where: { email: 'cos.staff@smartprint.dev' },
    update: { passwordHash: devPasswordHash, shopId: cos.shopId },
    create: {
      name: 'COS Shop Staff',
      email: 'cos.staff@smartprint.dev',
      phone: '9000000005',
      passwordHash: devPasswordHash,
      role: 'SHOP_STAFF',
      status: 'ACTIVE',
      shopId: cos.shopId,
    },
  });

  // Faculty accounts are never self-registered - see auth.service.ts::createFaculty.
  // This seeded account is eligible for free printing at CSE_FACULTY (see
  // shop.service.ts::isFreeFacultyShop) and follows normal payment rules
  // everywhere else, exactly like a real admin-provisioned faculty account.
  const faculty = await prisma.user.upsert({
    where: { email: 'faculty@smartprint.dev' },
    update: { passwordHash: devPasswordHash },
    create: {
      name: 'Faculty One',
      email: 'faculty@smartprint.dev',
      phone: '9000000003',
      passwordHash: devPasswordHash,
      role: 'FACULTY',
      status: 'ACTIVE',
    },
  });

  const students = await Promise.all(
    [1, 2, 3].map((n) =>
      prisma.user.upsert({
        where: { email: `student${n}@smartprint.dev` },
        update: { passwordHash: devPasswordHash },
        create: {
          name: `Student ${n}`,
          email: `student${n}@smartprint.dev`,
          phone: `900000001${n}`,
          passwordHash: devPasswordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      }),
    ),
  );

  const effectiveFrom = new Date('2026-01-01T00:00:00.000Z');

  // Each shop is independently priced (spec: "no global pricing / never use
  // another shop's price as a fallback") - these per-shopCode figures are
  // illustrative dev-seed data only, never hardcoded on the frontend. Every
  // shop, including CSE_FACULTY, gets a normal configurable pricing table;
  // the FACULTY+CSE_FACULTY ₹0 exemption is a role-based business rule
  // applied at order/preview time (see shopService.isFreeFacultyShop), not
  // a zeroed-out pricing table.
  const PRICING_BY_SHOP_CODE: Record<string, { bwSingle: number; bwDouble: number; colorSingle: number; spiral: number; staple: number }> = {
    G_BLOCK: { bwSingle: 2.0, bwDouble: 1.5, colorSingle: 8.0, spiral: 20, staple: 5 },
    COS: { bwSingle: 1.0, bwDouble: 0.75, colorSingle: 6.0, spiral: 15, staple: 3 },
    CSE_FACULTY: { bwSingle: 1.5, bwDouble: 1.0, colorSingle: 7.0, spiral: 18, staple: 4 },
  };

  for (const shop of shops) {
    const prices = PRICING_BY_SHOP_CODE[shop.shopCode] ?? PRICING_BY_SHOP_CODE.G_BLOCK!;

    await prisma.shopPricingRule.createMany({
      data: [
        {
          shopId: shop.shopId,
          printType: 'BW',
          paperSize: 'A4',
          sides: 'SINGLE',
          pricePerPage: prices.bwSingle,
          effectiveFrom,
        },
        {
          shopId: shop.shopId,
          printType: 'BW',
          paperSize: 'A4',
          sides: 'DOUBLE',
          pricePerPage: prices.bwDouble,
          effectiveFrom,
        },
        {
          shopId: shop.shopId,
          printType: 'COLOR',
          paperSize: 'A4',
          sides: 'SINGLE',
          pricePerPage: prices.colorSingle,
          effectiveFrom,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.shopFinishingRule.createMany({
      data: [
        {
          shopId: shop.shopId,
          finishingType: 'NONE',
          price: 0,
          isActive: true,
          effectiveFrom,
        },
        {
          shopId: shop.shopId,
          finishingType: 'SPIRAL_BINDING',
          price: prices.spiral,
          isActive: true,
          effectiveFrom,
        },
        {
          shopId: shop.shopId,
          finishingType: 'STAPLING',
          price: prices.staple,
          isActive: true,
          effectiveFrom,
        },
      ],
      skipDuplicates: true,
    });
  }

  // No sample Document rows are seeded (Phase 3+): a real Document now
  // requires an actual uploaded file on disk (storageKey/fileHash/etc.), so
  // fabricating DB rows here would reference files that don't exist. Use
  // POST /api/documents to create real documents for manual/dev testing.
  // No orders, payments, or queue entries are seeded either — those depend
  // on business logic implemented in later phases.

  // eslint-disable-next-line no-console
  console.log('Seed complete:', {
    admin: admin.email,
    shopStaff: [
      { email: shopStaff.email, assignedShop: gBlock.shopCode },
      { email: cseShopStaff.email, assignedShop: cseFaculty.shopCode },
      { email: cosShopStaff.email, assignedShop: cos.shopCode },
    ],
    faculty: faculty.email,
    students: students.map((s) => s.email),
    shops: shops.map((s) => s.shopCode),
    devPassword: DEV_PASSWORD,
  });
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
