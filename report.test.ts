import { describe, it, expect } from 'vitest'
import { partProgress, summarizeProgress, aggregate } from './report'
import type { SnapLine } from './production'
const L = (partId: string, q: number, cat = ''): SnapLine => ({ partId, partCode: partId, partName: partId, qtyPerUnit: q, unit: 'PCS', supplyCategoryId: cat })
describe('progress', () => {
  const lines = [L('A', 1, 'base'), L('B', 2, 'base'), L('C', 1, 'top'), L('D', 1)]
  it('computes status per part and filters by supply category', () => {
    const r = partProgress(lines, 100, { A: 100, B: 150, C: 10 }, '__all')
    expect(r.map(x => x.status)).toEqual(['COMPLETED', 'PARTIAL', 'PARTIAL'])
    expect(partProgress(lines, 100, {}, 'base').length).toBe(2)
    expect(partProgress(lines, 100, {}, '__all').map(x => x.partId)).not.toContain('D') // no category = not tracked
  })
  it('summarizes counts and shortage, over-supply not netted against shortage', () => {
    const s = summarizeProgress(partProgress(lines, 100, { A: 120, B: 50 }))
    expect(s).toMatchObject({ items: 3, completed: 0, partial: 1, notTaken: 1, over: 1, requiredQty: 400, takenQty: 170, shortageQty: 250 })
  })
})
describe('aggregate', () => {
  const tx = [{ id: '1', qty: 0.1, k: 'a' }, { id: '2', qty: 0.2, k: 'a' }, { id: '3', qty: 5, k: 'b' }, { id: '4', qty: 9, k: 'a' }]
  it('sums per key, skipping reversed transactions, no float noise', () => {
    const r = aggregate(tx, new Set(['4']), t => t.k)
    expect(r).toEqual([{ key: 'b', qty: 5, count: 1 }, { key: 'a', qty: 0.3, count: 2 }])
  })
})
