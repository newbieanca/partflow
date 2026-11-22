import { describe, it, expect } from 'vitest'
import { addDays, matchesCategory, NO_CATEGORY } from './supplyProfile'
describe('supply category filter', () => {
  it('shows only the chosen category', () => { expect(matchesCategory('base', 'base')).toBe(true); expect(matchesCategory('base', 'top')).toBe(false); expect(matchesCategory('base', '')).toBe(false) })
  it('"belum diatur" shows only parts without a category', () => { expect(matchesCategory(NO_CATEGORY, '')).toBe(true); expect(matchesCategory(NO_CATEGORY, 'base')).toBe(false) })
  it('shows nothing until a category is chosen', () => { expect(matchesCategory('', '')).toBe(false); expect(matchesCategory('', 'base')).toBe(false) })
})
describe('schedule date navigation', () => {
  it('moves by days across month and year ends', () => { expect(addDays('2026-11-30', 1)).toBe('2026-12-01'); expect(addDays('2026-01-01', -1)).toBe('2025-12-31'); expect(addDays('2026-11-23', 0)).toBe('2026-11-23') })
})
