import type { SupplyStatus } from './types'
// Decimals are never rounded; only float noise (1e-9) is removed so 0.1*3 shows 0.3.
const clean = (n: number) => Math.round(n * 1e9) / 1e9
export const requiredQty = (qtyPerUnit: number, productionQty: number) => {
  if (!(qtyPerUnit >= 0) || !(productionQty >= 0)) throw new Error('Quantities must be non-negative numbers')
  return clean(qtyPerUnit * productionQty)
}
export const remainingQty = (required: number, taken: number) => clean(required - taken)
export const takeAllQty = (required: number, taken: number) => Math.max(0, remainingQty(required, taken))
export const supplyStatus = (required: number, taken: number): SupplyStatus => {
  const r = remainingQty(required, taken)
  if (taken <= 0) return 'NOT_TAKEN'
  if (r > 0) return 'PARTIAL'
  return r === 0 ? 'COMPLETED' : 'OVER_SUPPLY'
}
