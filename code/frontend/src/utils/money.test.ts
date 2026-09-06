import { describe, expect, it } from 'vitest'

import { formatMoney, isZero } from './money'

describe('formatMoney', () => {
  it('formats a decimal string with 2 decimal places and a rupee sign', () => {
    expect(formatMoney('20')).toBe('₹20.00')
    expect(formatMoney('0')).toBe('₹0.00')
    expect(formatMoney('12.5')).toBe('₹12.50')
  })

  it('falls back to ₹0.00 for a non-numeric value', () => {
    expect(formatMoney('not-a-number')).toBe('₹0.00')
  })
})

describe('isZero', () => {
  it('treats "0" and 0 as zero', () => {
    expect(isZero('0')).toBe(true)
    expect(isZero(0)).toBe(true)
  })

  it('treats any nonzero decimal string as not zero - e.g. a faculty order at a normal shop', () => {
    expect(isZero('20')).toBe(false)
    expect(isZero('0.01')).toBe(false)
  })
})
