import {
  FinishingType,
  PaperSize,
  Prisma,
  PrintType,
  ShopFinishingRule,
  ShopPricingRule,
  Sides,
  UserRole,
} from '@prisma/client';

import { MAX_COPIES_PER_ITEM, MAX_ITEMS_PER_ORDER } from '../config/orderPolicy';
import { prisma } from '../config/prisma';
import * as documentService from './document.service';
import * as shopService from './shop.service';
import {
  CreateFinishingRuleInput,
  CreatePricingRuleInput,
  PreviewOrderInput,
  PreviewOrderItemInput,
  PricingPreviewResult,
  SafeFinishingRule,
  SafePricingRule,
  UpdateFinishingRuleInput,
} from '../types/pricing.types';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { resolvePageRange } from '../utils/pageRange';

const PRINT_TYPES = ['BW', 'COLOR'] as const;
const PAPER_SIZES = ['A4', 'A3', 'A5', 'LETTER', 'LEGAL'] as const;
const SIDES = ['SINGLE', 'DOUBLE'] as const;
const FINISHING_TYPES = [
  'SPIRAL_BINDING',
  'HARD_BINDING',
  'STAPLING',
  'LAMINATION',
  'NONE',
] as const;

// Sanity bound against typos/fat-fingering, not a real business limit -
// nothing in the current schema/business rules caps pricing otherwise.
const MAX_PRICE = 100000;

// ─────────────────────────────────────────────────────────────────────────
// Shared validation - reused by order creation AND the pricing preview, so
// both paths reject the exact same malformed input in the exact same way.
// ─────────────────────────────────────────────────────────────────────────

export function assertValidShopId(shopId: unknown): asserts shopId is string {
  if (typeof shopId !== 'string' || shopId.trim().length === 0) {
    throw new ValidationError('shopId is required');
  }
}

export function assertValidItemsArray(items: unknown): asserts items is unknown[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('At least one order item is required');
  }
  if (items.length > MAX_ITEMS_PER_ORDER) {
    throw new ValidationError(`An order may contain at most ${MAX_ITEMS_PER_ORDER} items`);
  }
}

function assertValidDocumentId(documentId: unknown): asserts documentId is string {
  if (typeof documentId !== 'string' || documentId.trim().length === 0) {
    throw new ValidationError('Each order item requires a documentId');
  }
}

function assertValidCopies(copies: unknown): asserts copies is number {
  if (typeof copies !== 'number' || !Number.isInteger(copies)) {
    throw new ValidationError('copies must be an integer');
  }
  if (copies < 1) {
    throw new ValidationError('copies must be at least 1');
  }
  if (copies > MAX_COPIES_PER_ITEM) {
    throw new ValidationError(`copies may not exceed ${MAX_COPIES_PER_ITEM} per item`);
  }
}

function assertValidPrintType(printType: unknown): asserts printType is (typeof PRINT_TYPES)[number] {
  if (typeof printType !== 'string' || !PRINT_TYPES.includes(printType as never)) {
    throw new ValidationError(`printType must be one of: ${PRINT_TYPES.join(', ')}`);
  }
}

function assertValidPaperSize(
  paperSize: unknown,
): asserts paperSize is (typeof PAPER_SIZES)[number] {
  if (typeof paperSize !== 'string' || !PAPER_SIZES.includes(paperSize as never)) {
    throw new ValidationError(`paperSize must be one of: ${PAPER_SIZES.join(', ')}`);
  }
}

function assertValidSides(sides: unknown): asserts sides is (typeof SIDES)[number] {
  if (typeof sides !== 'string' || !SIDES.includes(sides as never)) {
    throw new ValidationError(`sides must be one of: ${SIDES.join(', ')}`);
  }
}

function assertValidFinishingType(
  finishingType: unknown,
): asserts finishingType is (typeof FINISHING_TYPES)[number] {
  if (typeof finishingType !== 'string' || !FINISHING_TYPES.includes(finishingType as never)) {
    throw new ValidationError(`finishingType must be one of: ${FINISHING_TYPES.join(', ')}`);
  }
}

function assertValidPrice(value: unknown, fieldName: string): asserts value is number | string {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a number`);
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }
  if (num < 0) {
    throw new ValidationError(`${fieldName} must not be negative`);
  }
  if (num > MAX_PRICE) {
    throw new ValidationError(`${fieldName} exceeds the maximum allowed value of ${MAX_PRICE}`);
  }
  const fractional = num.toString().split('.')[1];
  if (fractional && fractional.length > 2) {
    throw new ValidationError(`${fieldName} may not have more than 2 decimal places`);
  }
}

function parseDate(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new ValidationError(`${fieldName} must be a valid date`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`);
  }
  return date;
}

function assertValidEffectiveFrom(value: unknown): Date {
  if (value === undefined || value === null) {
    return new Date();
  }
  return parseDate(value, 'effectiveFrom');
}

// Strict: used when opening a new effective window (rule creation). An
// effectiveTo equal to effectiveFrom would create a window that (under the
// inclusive resolution semantics below) is only ever effective for a single
// instant, which is never a meaningful configuration.
function assertValidEffectiveTo(value: unknown, effectiveFrom: Date): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const date = parseDate(value, 'effectiveTo');
  if (date <= effectiveFrom) {
    throw new ValidationError('effectiveTo must be after effectiveFrom');
  }
  return date;
}

// Looser: used when closing/deactivating an existing rule, where
// effectiveTo === effectiveFrom is a legitimate way to close a rule that
// never actually took effect (e.g. it was scheduled for the future).
function assertValidDeactivationDate(value: unknown, effectiveFrom: Date): Date {
  const date = value === undefined || value === null ? new Date() : parseDate(value, 'effectiveTo');
  if (date < effectiveFrom) {
    throw new ValidationError('effectiveTo cannot be before effectiveFrom');
  }
  return date;
}

// Effective-date semantics, matching Phase 4 order.service.ts exactly:
// effectiveFrom <= instant AND (effectiveTo is null OR effectiveTo >= instant).
// Both boundaries are inclusive.
function isEffectiveAt(effectiveFrom: Date, effectiveTo: Date | null, instant: Date): boolean {
  return effectiveFrom <= instant && (effectiveTo === null || effectiveTo >= instant);
}

// ─────────────────────────────────────────────────────────────────────────
// Overlap prevention - same inclusive-boundary convention as isEffectiveAt,
// so "no two rules are ever simultaneously effective" matches exactly what
// resolvePricingRule/resolveFinishingRule would otherwise treat as effective.
// ─────────────────────────────────────────────────────────────────────────

async function assertNoOverlappingPricingRule(
  shopId: string,
  printType: string,
  paperSize: string,
  sides: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  excludeRuleId?: string,
): Promise<void> {
  const conditions: Prisma.ShopPricingRuleWhereInput[] = [
    { shopId, printType: printType as PrintType, paperSize: paperSize as PaperSize, sides: sides as Sides },
    { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }] },
  ];
  if (effectiveTo !== null) {
    conditions.push({ effectiveFrom: { lte: effectiveTo } });
  }
  if (excludeRuleId) {
    conditions.push({ pricingRuleId: { not: excludeRuleId } });
  }

  const overlapping = await prisma.shopPricingRule.findFirst({ where: { AND: conditions } });
  if (overlapping) {
    throw new ConflictError(
      `A pricing rule for ${printType} / ${paperSize} / ${sides} already exists for an overlapping effective period`,
    );
  }
}

async function assertNoOverlappingFinishingRule(
  shopId: string,
  finishingType: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  excludeRuleId?: string,
): Promise<void> {
  const conditions: Prisma.ShopFinishingRuleWhereInput[] = [
    { shopId, finishingType: finishingType as FinishingType, isActive: true },
    { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }] },
  ];
  if (effectiveTo !== null) {
    conditions.push({ effectiveFrom: { lte: effectiveTo } });
  }
  if (excludeRuleId) {
    conditions.push({ finishingRuleId: { not: excludeRuleId } });
  }

  const overlapping = await prisma.shopFinishingRule.findFirst({ where: { AND: conditions } });
  if (overlapping) {
    throw new ConflictError(
      `A finishing rule for ${finishingType} already exists for an overlapping effective period`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Rule resolution - moved from order.service.ts verbatim (Phase 4 behavior
// preserved exactly). Both order creation and the pricing preview call
// these, so there is exactly one implementation of "which rule applies".
// ─────────────────────────────────────────────────────────────────────────

// Resolved server-side from (shopId, printType, paperSize, sides) - the
// client never supplies a pricingRuleId, so it can never reference a rule
// belonging to a different shop or pick an unsupported configuration.
export async function resolvePricingRule(
  shopId: string,
  printType: string,
  paperSize: string,
  sides: string,
): Promise<ShopPricingRule> {
  const now = new Date();
  const rule = await prisma.shopPricingRule.findFirst({
    where: {
      shopId,
      printType: printType as never,
      paperSize: paperSize as never,
      sides: sides as never,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (!rule) {
    throw new ValidationError(
      `This shop does not currently support ${printType} / ${paperSize} / ${sides} printing`,
    );
  }
  return rule;
}

// Validated against the SAME shop as the order - a finishingRuleId from
// another shop is rejected even if it is otherwise a valid, active rule.
export async function resolveFinishingRule(
  shopId: string,
  finishingRuleId: unknown,
): Promise<ShopFinishingRule | null> {
  if (finishingRuleId === undefined || finishingRuleId === null || finishingRuleId === '') {
    return null;
  }
  if (typeof finishingRuleId !== 'string') {
    throw new ValidationError('finishingRuleId must be a string');
  }

  const rule = await prisma.shopFinishingRule.findUnique({ where: { finishingRuleId } });
  const now = new Date();
  const isEffective = !!rule && isEffectiveAt(rule.effectiveFrom, rule.effectiveTo, now);

  if (!rule || rule.shopId !== shopId || !rule.isActive || !isEffective) {
    throw new ValidationError('Invalid finishing option selected for this shop');
  }
  return rule;
}

// ─────────────────────────────────────────────────────────────────────────
// Price calculation
// ─────────────────────────────────────────────────────────────────────────

export interface PriceableItemInput {
  documentId: unknown;
  copies: unknown;
  printType: unknown;
  paperSize: unknown;
  sides: unknown;
  pageRange?: unknown;
  finishingRuleId?: unknown;
}

export interface ResolvedPricedItem {
  documentId: string;
  fileName: string;
  copies: number;
  pricingRule: ShopPricingRule;
  finishingRule: ShopFinishingRule | null;
  pageRangeString: string | null;
  printPageCount: number;
  printCost: Prisma.Decimal;
  finishingCost: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

// Resolves a single line item end-to-end: document ownership, page-range
// selection, applicable pricing rule, optional finishing rule, and the
// resulting Decimal costs. Order creation and the pricing preview both
// call this - it is the ONLY place print-item pricing is computed.
export async function resolveAndPriceItem(
  userId: string,
  shopId: string,
  raw: PriceableItemInput,
): Promise<ResolvedPricedItem> {
  assertValidDocumentId(raw.documentId);
  assertValidCopies(raw.copies);
  assertValidPrintType(raw.printType);
  assertValidPaperSize(raw.paperSize);
  assertValidSides(raw.sides);

  // Ownership + existence: reuses the same check Phase 3 already enforces
  // for direct document access (404 for both "not found" and "not yours").
  const document = await documentService.getDocumentForUser(userId, raw.documentId);

  const { pageRangeString, selectedPageCount } = resolvePageRange(
    raw.pageRange,
    document.pageCount,
  );

  const pricingRule = await resolvePricingRule(shopId, raw.printType, raw.paperSize, raw.sides);
  const finishingRule = await resolveFinishingRule(shopId, raw.finishingRuleId);

  const printPageCount = selectedPageCount * raw.copies;
  const printCost = pricingRule.pricePerPage.mul(printPageCount);
  // Finishing (binding/stapling/lamination) is applied per physical copy -
  // each copy needs its own binding - so the cost scales with copies.
  const finishingCost = finishingRule ? finishingRule.price.mul(raw.copies) : new Prisma.Decimal(0);
  const lineTotal = printCost.add(finishingCost);

  return {
    documentId: document.documentId,
    fileName: document.fileName,
    copies: raw.copies,
    pricingRule,
    finishingRule,
    pageRangeString,
    printPageCount,
    printCost,
    finishingCost,
    lineTotal,
  };
}

export function calculateOrderTotal(items: { lineTotal: Prisma.Decimal }[]): Prisma.Decimal {
  return items.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
}

// ─────────────────────────────────────────────────────────────────────────
// Pricing preview - uses exactly the same resolveAndPriceItem/
// calculateOrderTotal as order creation; never creates any DB rows.
// ─────────────────────────────────────────────────────────────────────────

export async function calculatePricingPreview(
  userId: string,
  input: PreviewOrderInput,
  role: UserRole,
): Promise<PricingPreviewResult> {
  assertValidShopId(input.shopId);
  assertValidItemsArray(input.items);

  const shop = await shopService.assertShopAcceptsOrders(input.shopId);
  shopService.assertShopEligibleForRole(shop, role);

  const resolvedItems: ResolvedPricedItem[] = [];
  for (const rawItem of input.items as PreviewOrderItemInput[]) {
    resolvedItems.push(await resolveAndPriceItem(userId, shop.shopId, rawItem));
  }

  // FACULTY printing at the CSE Department Faculty Printer is a free
  // institutional entitlement (see shopService.isFreeFacultyShop) - the
  // preview must reflect the same ₹0 total the order will actually be
  // created with, never a nonzero figure the student/faculty member would
  // then be surprised to see disappear at order creation.
  const isFree = shopService.isFreeFacultyShop(shop, role);
  const zero = new Prisma.Decimal(0).toString();

  const totalAmount = isFree ? zero : calculateOrderTotal(resolvedItems).toString();

  return {
    shopId: shop.shopId,
    items: resolvedItems.map((item) => ({
      documentId: item.documentId,
      fileName: item.fileName,
      printType: item.pricingRule.printType,
      paperSize: item.pricingRule.paperSize,
      sides: item.pricingRule.sides,
      copies: item.copies,
      printPageCount: item.printPageCount,
      pricePerPage: isFree ? zero : item.pricingRule.pricePerPage.toString(),
      printCost: isFree ? zero : item.printCost.toString(),
      finishingType: item.finishingRule?.finishingType ?? null,
      finishingCost: isFree ? zero : item.finishingCost.toString(),
      lineTotal: isFree ? zero : item.lineTotal.toString(),
    })),
    totalAmount,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Shop pricing-rule management. ADMIN (any shop) or SHOP_STAFF (their own
// assigned, ACTIVE shop only) - see shopService.assertShopAccess, which
// re-derives the staff member's shop from the database on every call and
// never trusts the :shopId route param as proof of assignment. Reads
// (listPricingRules/listFinishingRules) stay open to any authenticated role
// so students can browse prices; only the mutations below are shop-scoped.
// ─────────────────────────────────────────────────────────────────────────

function isCurrentlyEffective(effectiveFrom: Date, effectiveTo: Date | null): boolean {
  return isEffectiveAt(effectiveFrom, effectiveTo, new Date());
}

function toSafePricingRule(rule: ShopPricingRule): SafePricingRule {
  return {
    pricingRuleId: rule.pricingRuleId,
    shopId: rule.shopId,
    printType: rule.printType,
    paperSize: rule.paperSize,
    sides: rule.sides,
    pricePerPage: rule.pricePerPage.toString(),
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    isCurrentlyEffective: isCurrentlyEffective(rule.effectiveFrom, rule.effectiveTo),
  };
}

function toSafeFinishingRule(rule: ShopFinishingRule): SafeFinishingRule {
  return {
    finishingRuleId: rule.finishingRuleId,
    shopId: rule.shopId,
    finishingType: rule.finishingType,
    price: rule.price.toString(),
    isActive: rule.isActive,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    isCurrentlyEffective: rule.isActive && isCurrentlyEffective(rule.effectiveFrom, rule.effectiveTo),
  };
}

export async function createPricingRule(
  shopId: string,
  input: CreatePricingRuleInput,
  requesterId: string,
  requesterRole: UserRole,
): Promise<SafePricingRule> {
  await shopService.assertShopAccess(requesterId, requesterRole, shopId);
  assertValidPrintType(input.printType);
  assertValidPaperSize(input.paperSize);
  assertValidSides(input.sides);
  assertValidPrice(input.pricePerPage, 'pricePerPage');

  const effectiveFrom = assertValidEffectiveFrom(input.effectiveFrom);
  const effectiveTo = assertValidEffectiveTo(input.effectiveTo, effectiveFrom);

  await assertNoOverlappingPricingRule(
    shopId,
    input.printType,
    input.paperSize,
    input.sides,
    effectiveFrom,
    effectiveTo,
  );

  const created = await prisma.shopPricingRule.create({
    data: {
      shopId,
      printType: input.printType as PrintType,
      paperSize: input.paperSize as PaperSize,
      sides: input.sides as Sides,
      pricePerPage: new Prisma.Decimal(input.pricePerPage as never),
      effectiveFrom,
      effectiveTo,
    },
  });

  return toSafePricingRule(created);
}

export async function listPricingRules(
  shopId: string,
  options: { current: boolean },
): Promise<SafePricingRule[]> {
  await shopService.getShopOrThrow(shopId);
  const now = new Date();

  const rules = await prisma.shopPricingRule.findMany({
    where: options.current
      ? {
          shopId,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        }
      : { shopId },
    orderBy: [
      { printType: 'asc' },
      { paperSize: 'asc' },
      { sides: 'asc' },
      { effectiveFrom: 'desc' },
    ],
  });

  return rules.map(toSafePricingRule);
}

// Safe deactivation only: a pricing rule already referenced by orders keeps
// its historical price snapshot on those orders untouched (OrderDocument
// stores its own copy of pricePerPage), so closing the rule's effective
// window here can never change what a past order cost. Price CHANGES are
// made by creating a new rule with a new effective period, never by
// mutating an existing rule's price.
export async function deactivatePricingRule(
  shopId: string,
  pricingRuleId: string,
  effectiveToInput: unknown,
  requesterId: string,
  requesterRole: UserRole,
): Promise<SafePricingRule> {
  await shopService.assertShopAccess(requesterId, requesterRole, shopId);

  const rule = await prisma.shopPricingRule.findUnique({ where: { pricingRuleId } });
  if (!rule || rule.shopId !== shopId) {
    throw new NotFoundError('Pricing rule not found');
  }

  const now = new Date();
  if (rule.effectiveTo !== null && rule.effectiveTo <= now) {
    throw new ConflictError('This pricing rule is already inactive');
  }

  const effectiveTo = assertValidDeactivationDate(effectiveToInput, rule.effectiveFrom);

  const updated = await prisma.shopPricingRule.update({
    where: { pricingRuleId },
    data: { effectiveTo },
  });

  return toSafePricingRule(updated);
}

export async function createFinishingRule(
  shopId: string,
  input: CreateFinishingRuleInput,
  requesterId: string,
  requesterRole: UserRole,
): Promise<SafeFinishingRule> {
  await shopService.assertShopAccess(requesterId, requesterRole, shopId);
  assertValidFinishingType(input.finishingType);
  assertValidPrice(input.price, 'price');

  const effectiveFrom = assertValidEffectiveFrom(input.effectiveFrom);
  const effectiveTo = assertValidEffectiveTo(input.effectiveTo, effectiveFrom);

  await assertNoOverlappingFinishingRule(shopId, input.finishingType, effectiveFrom, effectiveTo);

  const created = await prisma.shopFinishingRule.create({
    data: {
      shopId,
      finishingType: input.finishingType as FinishingType,
      price: new Prisma.Decimal(input.price as never),
      isActive: true,
      effectiveFrom,
      effectiveTo,
    },
  });

  return toSafeFinishingRule(created);
}

export async function listFinishingRules(
  shopId: string,
  options: { current: boolean },
): Promise<SafeFinishingRule[]> {
  await shopService.getShopOrThrow(shopId);
  const now = new Date();

  const rules = await prisma.shopFinishingRule.findMany({
    where: options.current
      ? {
          shopId,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        }
      : { shopId },
    orderBy: [{ finishingType: 'asc' }, { effectiveFrom: 'desc' }],
  });

  return rules.map(toSafeFinishingRule);
}

// Supports updating price/isActive/effectiveTo. Like pricing rules, a
// finishing rule already used by orders keeps historical orders unaffected
// (OrderDocument snapshots finishingPrice independently) - this only
// changes what future orders/previews will resolve to.
export async function updateFinishingRule(
  shopId: string,
  finishingRuleId: string,
  input: UpdateFinishingRuleInput,
  requesterId: string,
  requesterRole: UserRole,
): Promise<SafeFinishingRule> {
  await shopService.assertShopAccess(requesterId, requesterRole, shopId);

  const rule = await prisma.shopFinishingRule.findUnique({ where: { finishingRuleId } });
  if (!rule || rule.shopId !== shopId) {
    throw new NotFoundError('Finishing rule not found');
  }

  const data: Prisma.ShopFinishingRuleUpdateInput = {};

  if (input.price !== undefined) {
    assertValidPrice(input.price, 'price');
    data.price = new Prisma.Decimal(input.price as never);
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') {
      throw new ValidationError('isActive must be a boolean');
    }
    data.isActive = input.isActive;
  }

  let effectiveTo = rule.effectiveTo;
  if (input.effectiveTo !== undefined) {
    effectiveTo = assertValidDeactivationDate(input.effectiveTo, rule.effectiveFrom);
    data.effectiveTo = effectiveTo;
  }

  // Overlap can only be newly introduced by an update that (re)activates
  // the rule or extends/reopens its effective window - shrinking a window
  // or turning isActive off can never create a new overlap.
  const willBeActive = typeof data.isActive === 'boolean' ? data.isActive : rule.isActive;
  if (willBeActive && (input.isActive === true || input.effectiveTo !== undefined)) {
    await assertNoOverlappingFinishingRule(
      shopId,
      rule.finishingType,
      rule.effectiveFrom,
      effectiveTo,
      finishingRuleId,
    );
  }

  const updated = await prisma.shopFinishingRule.update({ where: { finishingRuleId }, data });
  return toSafeFinishingRule(updated);
}
