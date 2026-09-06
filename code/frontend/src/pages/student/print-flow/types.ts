import type { FinishingType, PaperSize, PrintType, SafeDocument, Sides } from '@/types'

export interface PrintSettings {
  printType: PrintType
  paperSize: PaperSize
  sides: Sides
  copies: number
  pageRangeMode: 'all' | 'custom'
  pageRange: string
  specialInstructions: string
  finishingType: FinishingType | null
  finishingRuleId: string | null
}

export const DEFAULT_SETTINGS: PrintSettings = {
  printType: 'BW',
  paperSize: 'A4',
  sides: 'SINGLE',
  copies: 1,
  pageRangeMode: 'all',
  pageRange: '',
  specialInstructions: '',
  finishingType: null,
  finishingRuleId: null,
}

// One order may bundle several documents (see order.service.ts's
// items: CreateOrderItemInput[]) - each keeps its own independent print
// settings. Keyed by documentId, which is safe because a document can only
// be added to the draft once (see StepDocument, which excludes already-added
// documents from the picker).
export interface OrderItemDraft {
  document: SafeDocument
  settings: PrintSettings
}

export const STEP_LABELS = ['Documents', 'Shop', 'Settings', 'Review', 'Payment', 'Queue']
