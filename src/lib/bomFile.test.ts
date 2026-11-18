import { describe, it, expect } from 'vitest'
import { detectCols, parseBomFile, signatureOf, requiredCols } from './bomFile'
const headers = ['Supplier', 'Material', 'Desc', 'Internal Model', 'External Model', 'QTY', 'Supply Kategori']
const cols = detectCols(headers)
const cats = { supplyCategories: [{ id: 'base', name: 'Supply Base' }] }
const row = (o: Record<string, unknown>) => ({ Supplier: 'S', Material: 'M1', Desc: 'Motor', 'Internal Model': 'X1', 'External Model': 'ES-T85CR-BK', QTY: 1, 'Supply Kategori': '', ...o })
describe('BOM file', () => {
  it('detects the user columns', () => {
    expect(cols).toEqual({ supplier: 'Supplier', material: 'Material', desc: 'Desc', internal: 'Internal Model', external: 'External Model', qty: 'QTY', supplyCategory: 'Supply Kategori' })
    expect(requiredCols(cols)).toBe(true)
  })
  it('groups many models from one sheet and skips QTY 0', () => {
    const r = parseBomFile([row({}), row({ Material: 'M2', QTY: 0 }), row({ 'External Model': 'ES-T90', Material: 'M1', QTY: 2 })], cols, cats)
    expect(r.errors).toEqual([]); expect(r.groups.length).toBe(2); expect(r.zeroRows).toBe(1)
    expect(r.groups[0].lines.length).toBe(1); expect(r.groups[0].skippedZero).toBe(1)
  })
  it('reports errors instead of importing bad rows', () => {
    const r = parseBomFile([row({ QTY: 'abc' }), row({ Material: '' }), row({ 'Supply Kategori': 'Nope' }), row({}), row({})], cols, cats)
    expect(r.errors.length).toBe(4)
    expect(r.errors.some(e => e.msg.startsWith('Duplikat'))).toBe(true)
    expect(r.groups[0].lines.length).toBe(1)
  })
  it('supply category is optional, known names resolve', () => {
    const r = parseBomFile([row({ 'Supply Kategori': 'supply base' }), row({ Material: 'M2' })], cols, cats)
    expect(r.errors).toEqual([]); expect(r.groups[0].lines.map(l => l.supplyCategoryId)).toEqual(['base', ''])
  })
  it('accepts decimal comma', () => { expect(parseBomFile([row({ QTY: '0,5' })], cols, cats).groups[0].lines[0].qty).toBe(0.5) })
  it('signature ignores order but detects changes', () => {
    const a = { partCode: 'A', qty: 1, supplyCategoryId: '' }, b = { partCode: 'B', qty: 2, supplyCategoryId: '' }
    expect(signatureOf([a, b])).toBe(signatureOf([b, a])); expect(signatureOf([a, b])).not.toBe(signatureOf([a, { ...b, qty: 3 }]))
  })
})
