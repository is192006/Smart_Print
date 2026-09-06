import type { FinishingType, PaperSize, PrintType, Sides } from '@/types'

export interface RecentPrintSetup {
  shopId: string
  shopName: string
  printType: PrintType
  paperSize: PaperSize
  sides: Sides
  copies: number
  finishingType: FinishingType | null
  finishingRuleId: string | null
  savedAt: string
}

const KEY = 'smartprint.recentSetup'

// Client-side-only convenience (never persisted server-side) - see
// SmartPrint frontend spec's "Recent setup" feature. Purely a UX shortcut;
// every value it prefills is re-validated/re-priced against the backend
// exactly like manual input would be.
export function getRecentSetup(): RecentPrintSetup | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RecentPrintSetup) : null
  } catch {
    return null
  }
}

export function saveRecentSetup(setup: Omit<RecentPrintSetup, 'savedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...setup, savedAt: new Date().toISOString() }))
  } catch {
    // Storage unavailable (private browsing, quota) - silently skip; this
    // is a convenience feature only, never load-bearing.
  }
}
