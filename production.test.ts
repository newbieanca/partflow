import { describe, it, expect } from 'vitest'
import { validateProduction, overSupplyAfterChange, type SnapLine } from './production'
const ok = { modelId: 'm', lineId: 'l', groupId: 'g', qty: 100, date: '2026-11-19' }
const L = (partId: string, q: number): SnapLine => ({ partId, partCode: partId, partName: partId, qtyPerUnit: q, unit: 'PCS', supplyCategoryId: '' })
describe('production validation', () => {
  it('accepts a valid form', () => expect(validateProduction(ok)).toEqual([]))
  it('rejects missing fields, bad qty and bad date', () => {
    expect(validateProduction({ ...ok, modelId: '' }).length).toBe(1)
    expect(validateProduction({ ...ok, qty: 0 }).length).toBe(1)
    expect(validateProduction({ ...ok, qty: 1.5 }).length).toBe(1)
    expect(validateProduction({ ...ok, date: '19-11-2026' }).length).toBe(1)
    expect(validateProduction({ modelId: '', lineId: '', groupId: '', qty: 0, date: '' }).length).toBe(5)
  })
})
describe('over-supply after quantity change', () => {
  it('flags parts already taken beyond the new requirement', () => {
    const r = overSupplyAfterChange([L('A', 1), L('B', 2)], 60, { A: 80, B: 100 })
    expect(r).toEqual([{ partId: 'A', partCode: 'A', partName: 'A', required: 60, taken: 80, excess: 20 }])
  })
  it('flags nothing when quantity increases or nothing is taken', () => {
    expect(overSupplyAfterChange([L('A', 1)], 200, { A: 80 })).toEqual([])
    expect(overSupplyAfterChange([L('A', 1)], 10, {})).toEqual([])
  })
})
