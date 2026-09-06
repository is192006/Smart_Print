import { api } from './apiClient'
import type {
  ApiSuccess,
  FinishingType,
  PaperSize,
  PricingPreviewRequest,
  PricingPreviewResult,
  PrintType,
  SafeFinishingRule,
  SafePricingRule,
  Sides,
} from '@/types'

export const pricingApi = {
  async preview(input: PricingPreviewRequest): Promise<PricingPreviewResult> {
    const res = await api.post<ApiSuccess<PricingPreviewResult>>('/pricing/preview', input)
    return res.data
  },

  async listPricingRules(shopId: string, includeInactive = false): Promise<SafePricingRule[]> {
    const query = includeInactive ? '?status=all' : ''
    const res = await api.get<ApiSuccess<{ pricingRules: SafePricingRule[] }>>(
      `/shops/${shopId}/pricing-rules${query}`,
    )
    return res.data.pricingRules
  },

  async createPricingRule(
    shopId: string,
    input: {
      printType: PrintType
      paperSize: PaperSize
      sides: Sides
      pricePerPage: number
      effectiveFrom?: string
      effectiveTo?: string
    },
  ): Promise<SafePricingRule> {
    const res = await api.post<ApiSuccess<{ pricingRule: SafePricingRule }>>(
      `/shops/${shopId}/pricing-rules`,
      input,
    )
    return res.data.pricingRule
  },

  async deactivatePricingRule(shopId: string, ruleId: string): Promise<SafePricingRule> {
    const res = await api.patch<ApiSuccess<{ pricingRule: SafePricingRule }>>(
      `/shops/${shopId}/pricing-rules/${ruleId}/deactivate`,
    )
    return res.data.pricingRule
  },

  async listFinishingRules(shopId: string, includeInactive = false): Promise<SafeFinishingRule[]> {
    const query = includeInactive ? '?status=all' : ''
    const res = await api.get<ApiSuccess<{ finishingRules: SafeFinishingRule[] }>>(
      `/shops/${shopId}/finishing-rules${query}`,
    )
    return res.data.finishingRules
  },

  async createFinishingRule(
    shopId: string,
    input: { finishingType: FinishingType; price: number; effectiveFrom?: string; effectiveTo?: string },
  ): Promise<SafeFinishingRule> {
    const res = await api.post<ApiSuccess<{ finishingRule: SafeFinishingRule }>>(
      `/shops/${shopId}/finishing-rules`,
      input,
    )
    return res.data.finishingRule
  },

  async updateFinishingRule(
    shopId: string,
    ruleId: string,
    input: Partial<{ price: number; isActive: boolean; effectiveTo: string }>,
  ): Promise<SafeFinishingRule> {
    const res = await api.patch<ApiSuccess<{ finishingRule: SafeFinishingRule }>>(
      `/shops/${shopId}/finishing-rules/${ruleId}`,
      input,
    )
    return res.data.finishingRule
  },
}
