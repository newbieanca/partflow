// Backup helpers shared by backup.mjs / restore.mjs. Same JSON format as src/lib/backupFormat.ts (Timestamp -> { __ts: ISO }).
export const COLLECTIONS = ['users', 'productCategories', 'supplyCategories', 'productionLines', 'operatorGroups', 'shifts', 'models', 'parts', 'bomHeaders', 'bomDetails', 'productions', 'productionBomSnapshots', 'supplyTransactions', 'supplyTotals', 'transactionAdjustments', 'auditLogs', 'appSettings']
export const EXCEL_SKIP = new Set(['productionBomSnapshots', 'supplyTotals'])
export function encode(v) {
  if (v == null) return v
  if (typeof v.toDate === 'function') return { __ts: v.toDate().toISOString() }
  if (v instanceof Date) return { __ts: v.toISOString() }
  if (Array.isArray(v)) return v.map(encode)
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]))
  return v
}
export function decode(v, makeTs) {
  if (v == null) return v
  if (Array.isArray(v)) return v.map(x => decode(x, makeTs))
  if (typeof v === 'object') { if (Object.keys(v).length === 1 && typeof v.__ts === 'string') return makeTs(v.__ts); return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x, makeTs)])) }
  return v
}
export function flatten(id, data) {
  const row = { id }
  for (const [k, raw] of Object.entries(encode(data))) {
    if (raw == null) row[k] = ''
    else if (typeof raw === 'object' && '__ts' in raw) row[k] = raw.__ts
    else if (typeof raw === 'object') row[k] = JSON.stringify(raw).slice(0, 32000)
    else row[k] = raw
  }
  return row
}
/** Reads every document of the given collections in pages (db is a firebase-admin Firestore, or anything shaped like it). */
export async function exportAll(db, collections = COLLECTIONS, { page = 2000, onPage } = {}) {
  const out = {}
  for (const c of collections) {
    const docs = []; let last = null
    for (;;) {
      let q = db.collection(c).orderBy('__name__').limit(page); if (last) q = q.startAfter(last)
      const s = await q.get(); for (const d of s.docs) docs.push({ id: d.id, data: encode(d.data()) })
      onPage?.(c, docs.length); if (s.docs.length < page) break; last = s.docs[s.docs.length - 1]
    }
    out[c] = docs
  }
  return out
}
/** Writes documents back (set = same id is overwritten, nothing is ever deleted). Dry run unless apply is true. */
export async function restoreAll(db, collections, { makeTs, apply = false, only, batchSize = 400 } = {}) {
  const summary = {}; let batch = null; let n = 0
  for (const [c, docs] of Object.entries(collections)) {
    if (only && !only.includes(c)) continue
    summary[c] = docs.length; if (!apply) continue
    for (const d of docs) { if (!batch) { batch = db.batch(); n = 0 } batch.set(db.collection(c).doc(d.id), decode(d.data, makeTs)); if (++n >= batchSize) { await batch.commit(); batch = null } }
  }
  if (batch) await batch.commit()
  return summary
}
