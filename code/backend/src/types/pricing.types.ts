import { FinishingType, PaperSize, PrintType, Sides } from '@prisma/client';

export interface CreatePricingRuleInput {
  printType: unknown;
  paperSize: unknown;
  sides: unknown;
  pricePerPage: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
}

export interface DeactivatePricingRuleInput {
  effectiveTo?: unknown;
}

export interface CreateFinishingRuleInput {
  finishingType: unknown;
  price: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
}

export interface UpdateFinishingRuleInput {
  price?: unknown;
  isActive?: unknown;
  effectiveTo?: unknown;
}

// Safe, API-facing shapes - never leak internal-only fields.
export interface SafePricingRule {
  pricingRuleId: string;
  shopId: string;
  printType: PrintType;
  paperSize: PaperSize;
  sides: Sides;
  pricePerPage: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isCurrentlyEffective: boolean;
}

export interface SafeFinishingRule {
  finishingRuleId: string;
  shopId: string;
  finishingType: FinishingType;
  price: string;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isCurrentlyEffective: boolean;
}

// Inputs to a pricing preview - deliberately mirrors CreateOrderItemInput /
// CreateOrderInput (order.types.ts) so the preview and order-creation
// request bodies are interchangeable.
export interface PreviewOrderItemInput {
  documentId: unknown;
  copies: unknown;
  printType: unknown;
  paperSize: unknown;
  sides: unknown;
  pageRange?: unknown;
  finishingRuleId?: unknown;
}

export interface PreviewOrderInput {
  shopId: unknown;
  items: unknown;
}

export interface PricingPreviewItem {
  documentId: string;
  fileName: string;
  printType: PrintType;
  paperSize: PaperSize;
  sides: Sides;
  copies: number;
  printPageCount: number;
  pricePerPage: string;
  printCost: string;
  finishingType: FinishingType | null;
  finishingCost: string;
  lineTotal: string;
}

export interface PricingPreviewResult {
  shopId: string;
  items: PricingPreviewItem[];
  totalAmount: string;
}
