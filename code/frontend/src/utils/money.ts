// Backend money fields are decimal strings (e.g. "20", "0", "12.50") -
// this only formats for display; the numeric value always comes from the
// server and is never recomputed here.
export function formatMoney(value: string | number): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return '₹0.00'
  return `₹${num.toFixed(2)}`
}

export function isZero(value: string | number): boolean {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) && num === 0
}
