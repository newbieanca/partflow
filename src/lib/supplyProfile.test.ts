import { describe, it, expect } from 'vitest'
import { addDays, matchesCategory } from './supplyProfile'
describe('supply category filter', () => {
  it('shows only the chosen category', () => { expect(matchesCategory('base', 'base')).toBe(true); expect(matchesCategory('base', 'top')).toBe(false); expect(matchesCategory('base', '')).toBe(false) })
  it('parts without a category are never shown (not tracked)', () => { expect(matchesCategory('base', '')).toBe(false); expect(matchesCategory('', '')).toBe(false) })
  it('shows nothing until a category is chosen', () => { expect(matchesCategory('', '')).toBe(false); expect(matchesCategory('', 'base')).toBe(false) })
})
describe('schedule date navigation', () => {
  it('moves by days across month and year ends', () => { expect(addDays('2026-11-30', 1)).toBe('2026-12-01'); expect(addDays('2026-01-01', -1)).toBe('2025-12-31'); expect(addDays('2026-11-23', 0)).toBe('2026-11-23') })
})
