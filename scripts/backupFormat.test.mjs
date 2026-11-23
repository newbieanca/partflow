import { describe, it, expect } from 'vitest'
import { decode, encode, exportAll, restoreAll } from './backupFormat.mjs'
const ts = iso => ({ toDate: () => new Date(iso) })
// Minimal in-memory stand-in for firebase-admin Firestore (pagination, batches)
function fakeDb(store) {
  const written = []
  return { written, collection: name => ({
    orderBy: () => ({ limit: n => { const q = { start: 0, async get() { const all = store[name] ?? []; const docs = all.slice(q.start, q.start + n).map(d => ({ id: d.id, data: () => d.data })); return { docs } }, startAfter(last) { q.start = (store[name] ?? []).findIndex(d => d.id === last.id) + 1; return q } }; return q } }),
    doc: id => ({ col: name, id }) }),
    batch: () => { const ops = []; return { set: (ref, data) => ops.push([ref, data]), commit: async () => { written.push(...ops) } } } }
}
describe('backup encode/decode', () => {
  it('round-trips timestamps', () => {
    const e = encode({ a: ts('2026-11-23T10:00:00Z'), l: [{ t: ts('2026-01-01T00:00:00Z') }] }); expect(e.a).toEqual({ __ts: '2026-11-23T10:00:00.000Z' })
    const d = decode(e, iso => ({ ts: iso })); expect(d.a).toEqual({ ts: '2026-11-23T10:00:00.000Z' }); expect(d.l[0].t).toEqual({ ts: '2026-01-01T00:00:00.000Z' })
  })
  it('does not mistake ordinary objects for timestamps', () => { expect(decode({ __ts: 'x', other: 1 }, () => 'TS')).toEqual({ __ts: 'x', other: 1 }) })
})
describe('exportAll / restoreAll with a fake database', () => {
  const store = { parts: Array.from({ length: 5 }, (_, i) => ({ id: `P${i}`, data: { code: `P${i}`, createdAt: ts('2026-11-23T10:00:00Z') } })), models: [{ id: 'm1', data: { name: 'ES-T85' } }] }
  it('exports every document across pages, in order, with timestamps encoded', async () => {
    const out = await exportAll(fakeDb(store), ['parts', 'models', 'empty'], { page: 2 })
    expect(out.parts.map(d => d.id)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4']); expect(out.parts[0].data.createdAt).toEqual({ __ts: '2026-11-23T10:00:00.000Z' }); expect(out.models.length).toBe(1); expect(out.empty).toEqual([])
  })
  it('restore is a dry run by default and writes nothing', async () => {
    const db = fakeDb({}); const data = await exportAll(fakeDb(store), ['parts'], { page: 2 })
    expect(await restoreAll(db, data, { makeTs: x => x })).toEqual({ parts: 5 }); expect(db.written).toEqual([])
  })
  it('restore with apply writes every document back with timestamps restored, in batches', async () => {
    const db = fakeDb({}); const data = await exportAll(fakeDb(store), ['parts', 'models'], { page: 2 })
    await restoreAll(db, data, { makeTs: iso => ({ ts: iso }), apply: true, batchSize: 2 })
    expect(db.written.length).toBe(6); expect(db.written[0][0]).toEqual({ col: 'parts', id: 'P0' }); expect(db.written[0][1].createdAt).toEqual({ ts: '2026-11-23T10:00:00.000Z' })
  })
  it('restore can be limited to chosen collections', async () => {
    const db = fakeDb({}); const data = await exportAll(fakeDb(store), ['parts', 'models'])
    await restoreAll(db, data, { makeTs: x => x, apply: true, only: ['models'] }); expect(db.written.map(w => w[0].col)).toEqual(['models'])
  })
})
