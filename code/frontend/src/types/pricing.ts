export type PrintType = 'BW' | 'COLOR'
export type PaperSize = 'A4' | 'A3' | 'A5' | 'LETTER' | 'LEGAL'
export type Sides = 'SINGLE' | 'DOUBLE'
export type FinishingType = 'SPIRAL_BINDING' | 'HARD_BINDING' | 'STAPLING' | 'LAMINATION' | 'NONE'

export interface SafePricingRule {
  pricingRuleId: string
  shopId: string
  printType: PrintType
  paperSize: PaperSize
  sides: Sides
  pricePerPage: string
  effectiveFrom: string
  effectiveTo: string | null
  isCurrentlyEffective: boolean
}

export interface SafeFinishingRule {
  finishingRuleId: string
  shopId: string
  finishingType: FinishingType
  price: string
  isActive: boolean
  effectiveFrom: string
  effectiveTo: string | null
  isCurrentlyEffective: boolean
}

export interface PricingPreviewItemInput {
  documentId: string
  copies: number
  printType: PrintType
  paperSize: PaperSize
  sides: Sides
  pageRange?: string
  finishingRuleId?: string
}

export interface PricingPreviewRequest {
  shopId: string
  items: PricingPreviewItemInput[]
}

export interface PricingPreviewItemResult {
  documentId: string
  fileName: string
  printType: PrintType
  paperSize: PaperSize
  sides: Sides
  copies: number
  printPageCount: number
  pricePerPage: string
  printCost: string
  finishingType: FinishingType | null
  finishingCost: string
  lineTotal: string
}

export interface PricingPreviewResult {
  shopId: string
  items: PricingPreviewItemResult[]
  totalAmount: string
}
