import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { pricingApi } from '@/services/pricingApi'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { FinishingType, PricingPreviewResult, SafeFinishingRule, SafeShop } from '@/types'
import { formatMoney, isZero } from '@/utils/money'
import { DocumentSettingsCard } from './DocumentSettingsCard'
import type { OrderItemDraft, PrintSettings } from './types'

const FINISHING_LABEL: Record<FinishingType, string> = {
  NONE: 'None',
  SPIRAL_BINDING: 'Spiral binding',
  HARD_BINDING: 'Hard binding',
  STAPLING: 'Stapling',
  LAMINATION: 'Lamination',
}

interface StepSettingsProps {
  shop: SafeShop
  items: OrderItemDraft[]
  onChangeItemSettings: (documentId: string, settings: PrintSettings) => void
  onRemoveItem: (documentId: string) => void
  onAddAnotherDocument: () => void
  onContinue: (preview: PricingPreviewResult) => void
  onBack: () => void
}

// One combined price panel covers every document in the order draft - the
// backend's pricing preview already accepts multiple items in one call (see
// pricing.service.ts::calculatePricingPreview), so this is never the sum of
// N separate previews computed client-side.
export function StepSettings({
  shop,
  items,
  onChangeItemSettings,
  onRemoveItem,
  onAddAnotherDocument,
  onContinue,
  onBack,
}: StepSettingsProps) {
  const [finishingRules, setFinishingRules] = useState<SafeFinishingRule[] | null>(null)
  const [preview, setPreview] = useState<PricingPreviewResult | null>(null)
  const [isPricing, setIsPricing] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    pricingApi
      .listFinishingRules(shop.shopId)
      .then((rules) => {
        if (!cancelled) setFinishingRules(rules)
      })
      .catch(() => {
        if (!cancelled) setFinishingRules([])
      })
    return () => {
      cancelled = true
    }
  }, [shop.shopId])

  const finishingOptions = (finishingRules ?? []).filter((r) => r.isCurrentlyEffective)

  const debouncedItems = useDebouncedValue(items, 450)

  useEffect(() => {
    if (debouncedItems.length === 0) {
      setPreview(null)
      return
    }
    if (debouncedItems.some((item) => item.settings.pageRangeMode === 'custom' && !item.settings.pageRange.trim())) {
      setPreview(null)
      return
    }

    let cancelled = false
    setIsPricing(true)
    setPricingError(null)

    pricingApi
      .preview({
        shopId: shop.shopId,
        items: debouncedItems.map((item) => ({
          documentId: item.document.documentId,
          copies: item.settings.copies,
          printType: item.settings.printType,
          paperSize: item.settings.paperSize,
          sides: item.settings.sides,
          pageRange: item.settings.pageRangeMode === 'custom' ? item.settings.pageRange.trim() : undefined,
          finishingRuleId: item.settings.finishingRuleId ?? undefined,
        })),
      })
      .then((result) => {
        if (!cancelled) setPreview(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null)
          setPricingError(err?.message || 'Could not calculate price for this order.')
        }
      })
      .finally(() => {
        if (!cancelled) setIsPricing(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.shopId, JSON.stringify(debouncedItems)])

  const isFree = preview ? isZero(preview.totalAmount) : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {items.map((item) => (
        <DocumentSettingsCard
          key={item.document.documentId}
          document={item.document}
          settings={item.settings}
          onChange={(settings) => onChangeItemSettings(item.document.documentId, settings)}
          onRemove={items.length > 1 ? () => onRemoveItem(item.document.documentId) : undefined}
          finishingOptions={finishingOptions}
        />
      ))}

      <Button variant="secondary" onClick={onAddAnotherDocument}>
        + Add another document
      </Button>

      <Card padded={false} className={`price-panel ${isFree ? 'price-panel--free' : ''}`} style={{ border: 'none' }}>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="price-panel__total-label">Print summary</span>
            {isPricing && <Spinner size={15} inverted />}
          </div>

          {pricingError ? (
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)' }}>{pricingError}</p>
          ) : preview ? (
            <>
              {preview.items.map((item, i) => (
                <div className="price-panel__row" key={i}>
                  <span>{item.fileName}</span>
                  <span>{formatMoney((Number(item.printCost) + Number(item.finishingCost)).toFixed(2))}</span>
                </div>
              ))}
              {preview.items.some((i) => i.finishingType && i.finishingType !== 'NONE') && (
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                  Includes finishing:{' '}
                  {preview.items
                    .filter((i) => i.finishingType && i.finishingType !== 'NONE')
                    .map((i) => `${i.fileName} (${FINISHING_LABEL[i.finishingType!]})`)
                    .join(', ')}
                </p>
              )}
              <div className="price-panel__divider" />
              <div className="price-panel__total-row">
                <span className="price-panel__total-label">Total</span>
                <span className="price-panel__total-value">{isFree ? 'Free' : formatMoney(preview.totalAmount)}</span>
              </div>
              {isFree && (
                <p style={{ fontSize: 12.5, marginTop: 10, color: 'rgba(255,255,255,0.85)' }}>
                  Faculty printing — payment not required.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)' }}>
              {isPricing ? 'Calculating…' : 'Choose your settings to see the price.'}
            </p>
          )}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button block size="lg" disabled={!preview} onClick={() => preview && onContinue(preview)}>
          Continue
        </Button>
      </div>
    </div>
  )
}
