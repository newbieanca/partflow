import { describe, it, expect } from 'vitest'
import { detectCols, planCategories } from './partCategoryFile'
const cats = [{ id: 'base', name: 'Supply Base' }, { id: 'top', name: 'Supply Top Cover' }]
const parts = [{ id: 'A1', code: 'A1', name: 'Motor', supplyCategoryId: '' }, { id: 'B2', code: 'B2', name: 'Hose', supplyCategoryId: 'base' }, { id: 'C3', code: 'C3', name: 'Cap', supplyCategoryId: '' }]
const cols = { code: 'Material', category: 'Supply Kategori' }
const run = (rows: Record<string, unknown>[]) => planCategories(rows, cols, { categories: cats, parts })
describe('part category import', () => {
  it('detects columns from the Excel headers', () => { expect(detectCols(['Material', 'Desc', 'Supply Kategori'])).toEqual({ code: 'Material', category: 'Supply Kategori' }); expect(detectCols(['Kode Part', 'Kategori'])).toEqual({ code: 'Kode Part', category: 'Kategori' }) })
  it('plans only the parts whose category changes', () => {
    const p = run([{ Material: 'a1', 'Supply Kategori': 'supply base' }, { Material: 'B2', 'Supply Kategori': 'Supply Base' }, { Material: 'C3', 'Supply Kategori': 'Supply Top Cover' }])
    expect(p.changes.map(c => [c.partId, c.to])).toEqual([['A1', 'base'], ['C3', 'top']]); expect(p.unchanged).toBe(1); expect(p.errors).toEqual([])
  })
  it('empty category = not tracked: ignored, never an error, never clears an existing category', () => {
    const p = run([{ Material: 'A1', 'Supply Kategori': '' }, { Material: 'B2', 'Supply Kategori': '' }]); expect(p.ignoredEmpty).toBe(2); expect(p.changes).toEqual([]); expect(p.errors).toEqual([])
  })
  it('reports unknown category, missing code and conflicting duplicates as errors', () => {
    const p = run([{ Material: 'A1', 'Supply Kategori': 'Nope' }, { Material: '', 'Supply Kategori': 'Supply Base' }, { Material: 'C3', 'Supply Kategori': 'Supply Base' }, { Material: 'C3', 'Supply Kategori': 'Supply Top Cover' }])
    expect(p.errors.length).toBe(3)
  })
  it('identical duplicate rows are harmless; unknown parts are reported, not created', () => {
    const p = run([{ Material: 'C3', 'Supply Kategori': 'Supply Base' }, { Material: 'C3', 'Supply Kategori': 'Supply Base' }, { Material: 'ZZ9', 'Supply Kategori': 'Supply Base' }])
    expect(p.errors).toEqual([]); expect(p.changes.length).toBe(1); expect(p.unknownParts).toEqual([{ row: 4, code: 'ZZ9' }])
  })
})
