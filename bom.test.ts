import { describe, it, expect } from 'vitest'
import { requiredQty, remainingQty, takeAllQty, supplyStatus } from './bom'
describe('BOM calculation', () => {
  it('multiplies BOM qty by production qty', () => {
    expect(requiredQty(1, 100)).toBe(100)
    expect(requiredQty(2, 100)).toBe(200)
  })
  it('supports decimals without rounding', () => {
    expect(requiredQty(0.1, 3)).toBe(0.3)
    expect(requiredQty(0.25, 10)).toBe(2.5)
  })
  it('rejects negatives', () => { expect(() => requiredQty(-1, 5)).toThrow() })
})
describe('Take All / remaining / status', () => {
  it('Take All proposes remaining, never the original requirement', () => {
    expect(takeAllQty(100, 60)).toBe(40)
    expect(takeAllQty(100, 100)).toBe(0)
    expect(takeAllQty(100, 120)).toBe(0)
  })
  it('multi-shift total reaches completion', () => {
    expect(remainingQty(100, 60 + 25 + 15)).toBe(0)
    expect(supplyStatus(100, 100)).toBe('COMPLETED')
  })
  it('statuses', () => {
    expect(supplyStatus(100, 0)).toBe('NOT_TAKEN')
    expect(supplyStatus(100, 60)).toBe('PARTIAL')
    expect(supplyStatus(100, 101)).toBe('OVER_SUPPLY')
  })
})
