import { describe, it, expect } from 'vitest'
import { encode, flatten } from './backupFormat'
const ts = (iso: string) => ({ toDate: () => new Date(iso) })
describe('backup format', () => {
  it('encodes timestamps recursively and leaves plain values alone', () => {
    expect(encode({ a: 1, t: ts('2026-11-23T10:00:00Z'), n: { t: ts('2026-01-01T00:00:00Z') }, l: [ts('2026-02-02T00:00:00Z'), 'x'], z: null }))
      .toEqual({ a: 1, t: { __ts: '2026-11-23T10:00:00.000Z' }, n: { t: { __ts: '2026-01-01T00:00:00.000Z' } }, l: [{ __ts: '2026-02-02T00:00:00.000Z' }, 'x'], z: null })
  })
  it('flattens a document into one spreadsheet row', () => {
    const r = flatten('d1', { qty: 3, name: 'Motor', createdAt: ts('2026-11-23T10:00:00Z'), lines: [{ a: 1 }], none: null })
    expect(r).toEqual({ id: 'd1', qty: 3, name: 'Motor', createdAt: '2026-11-23T10:00:00.000Z', lines: '[{"a":1}]', none: '' })
  })
  it('truncates huge nested values below the Excel cell limit', () => {
    expect(String(flatten('x', { big: Array.from({ length: 20000 }, (_, i) => ({ i })) }).big).length).toBeLessThanOrEqual(32000)
  })
})
