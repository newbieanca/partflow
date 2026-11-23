import { describe, it, expect } from 'vitest'
import { decideTake, effectiveQty, lossPackDelta, OverSupplyError } from './takeLogic'
describe('Take All', () => {
  it('proposes the current remaining, not the original requirement', () => {
    expect(decideTake(100, 60, 'TAKE_ALL', 999, false)).toMatchObject({ qty: 40, type: 'TAKE_ALL' })
  })
  it('refuses when nothing remains', () => {
    expect(() => decideTake(100, 100, 'TAKE_ALL', 0, false)).toThrow('Tidak ada sisa')
    expect(() => decideTake(100, 120, 'TAKE_ALL', 0, false)).toThrow('Tidak ada sisa')
  })
})
describe('Partial take and multi-shift', () => {
  it('60 + 25 + 15 completes exactly with no over-supply', () => {
    expect(decideTake(100, 0, 'PARTIAL', 60, false).type).toBe('PARTIAL')
    expect(decideTake(100, 60, 'PARTIAL', 25, false).type).toBe('PARTIAL')
    expect(decideTake(100, 85, 'PARTIAL', 15, false).type).toBe('PARTIAL')
  })
  it('rejects zero, negative and NaN quantities', () => {
    for (const q of [0, -1, NaN]) expect(() => decideTake(100, 0, 'PARTIAL', q, false)).toThrow()
  })
})
describe('Over-supply', () => {
  it('requires confirmation and reports required/taken/remaining/excess', () => {
    try { decideTake(100, 85, 'PARTIAL', 20, false); throw new Error('no throw') } catch (e) {
      expect(e).toBeInstanceOf(OverSupplyError)
      expect((e as OverSupplyError).info).toEqual({ required: 100, taken: 85, remaining: 15, excess: 5 })
    }
  })
  it('saves as OVER_SUPPLY once confirmed', () => { expect(decideTake(100, 85, 'PARTIAL', 20, true)).toMatchObject({ qty: 20, type: 'OVER_SUPPLY' }) })
  it('any take after completion is over-supply', () => { expect(() => decideTake(100, 100, 'PARTIAL', 1, false)).toThrow(OverSupplyError) })
  it('decimals do not cause false over-supply', () => { expect(decideTake(0.3, 0.2, 'PARTIAL', 0.1, false).type).toBe('PARTIAL') })
})

describe('Loss pack correction', () => {
  it('delta is actual minus recorded', () => { expect(lossPackDelta(100, 97)).toBe(-3); expect(lossPackDelta(50, 52)).toBe(2) })
  it('rejects no-change, negative and NaN actuals', () => { expect(() => lossPackDelta(100, 100)).toThrow('sama'); expect(() => lossPackDelta(100, -1)).toThrow(); expect(() => lossPackDelta(100, NaN)).toThrow() })
  it('effective quantity keeps the original untouched and avoids float noise', () => { expect(effectiveQty(100, -3)).toBe(97); expect(effectiveQty(0.3, -0.1)).toBe(0.2); expect(effectiveQty(40)).toBe(40) })
  it('a corrected box that was short reopens the remaining requirement', () => {
    // required 100, box recorded 100 (taken 100) but really had 97 -> taken 97, remaining 3
    const delta = lossPackDelta(100, 97); expect(decideTake(100, 100 + delta, 'TAKE_ALL', 0, false)).toMatchObject({ qty: 3 })
  })
})
