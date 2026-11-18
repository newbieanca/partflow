import { describe, it, expect } from 'vitest'
import { parseQty, validateRows } from './bomImport'
const m = { partCode: 'Code', partName: 'Name', qty: 'Qty', unit: 'Unit', supplyCategory: 'Cat' }
const ctx = { supplyCategories: [{ id: 'base', name: 'Supply Base' }], knownPartIds: new Set(['A1']), allowNewParts: false }
describe('BOM import validation', () => {
  it('parses decimals incl. comma', () => { expect(parseQty('0,5')).toBe(0.5); expect(parseQty(2)).toBe(2); expect(parseQty('x')).toBeNaN() })
  it('accepts a valid row', () => {
    const [r] = validateRows([{ Code: 'a1', Name: 'Motor', Qty: 1, Unit: 'PCS', Cat: 'supply base' }], m, ctx)
    expect(r.errors).toEqual([])
  })
  it('flags bad qty, unknown category, duplicate and unknown part', () => {
    const rows = validateRows([
      { Code: 'A1', Name: 'x', Qty: 0, Unit: 'PCS', Cat: 'Nope' },
      { Code: 'A1', Name: 'x', Qty: 1, Unit: 'PCS', Cat: 'Supply Base' },
      { Code: 'Z9', Name: 'x', Qty: 1, Unit: 'PCS', Cat: 'Supply Base' }], m, ctx)
    expect(rows[0].errors.length).toBe(2)
    expect(rows[1].errors).toContain('Kode part duplikat di file')
    expect(rows[2].errors).toContain('Part belum ada di master part')
  })
  it('allows new parts only when explicitly enabled', () => {
    const [r] = validateRows([{ Code: 'Z9', Name: 'x', Qty: 1, Unit: 'PCS', Cat: 'Supply Base' }], m, { ...ctx, allowNewParts: true })
    expect(r.errors).toEqual([]); expect(r.isNewPart).toBe(true)
  })
})
