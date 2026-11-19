import { describe, it, expect } from 'vitest'
import { decideTake, OverSupplyError } from './takeLogic'
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
