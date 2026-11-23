import { requiredQty, remainingQty, sumQty, supplyStatus } from './bom'
import type { SnapLine } from './production'
export interface PartRow { partId: string; partCode: string; partName: string; unit: string; supplyCategoryId: string; required: number; taken: number; remaining: number; status: string }
/** Only parts WITH a supply category are tracked. catFilter: '__all' = every tracked part, otherwise a supply category id. */
export function partProgress(lines: SnapLine[], qty: number, taken: Record<string, number>, catFilter = '__all'): PartRow[] {
  return lines.filter(l => !!l.supplyCategoryId && (catFilter === '__all' || l.supplyCategoryId === catFilter)).map(l => {
    const required = requiredQty(l.qtyPerUnit, qty); const t = taken[l.partId] ?? 0
    return { partId: l.partId, partCode: l.partCode, partName: l.partName, unit: l.unit, supplyCategoryId: l.supplyCategoryId, required, taken: t, remaining: remainingQty(required, t), status: supplyStatus(required, t) }
  })
}
export function summarizeProgress(rows: PartRow[]) {
  const c = (s: string) => rows.filter(r => r.status === s).length
  return { items: rows.length, completed: c('COMPLETED'), partial: c('PARTIAL'), notTaken: c('NOT_TAKEN'), over: c('OVER_SUPPLY'),
    requiredQty: rows.reduce((a, r) => sumQty(a, r.required), 0), takenQty: rows.reduce((a, r) => sumQty(a, r.taken), 0), shortageQty: rows.reduce((a, r) => sumQty(a, Math.max(0, r.remaining)), 0) }
}
/** Group transactions by a key, ignoring reversed ones. */
export function aggregate<T extends { id: string; qty: number }>(txs: T[], reversed: Set<string>, key: (t: T) => string) {
  const m = new Map<string, { key: string; qty: number; count: number }>()
  txs.forEach(t => { if (reversed.has(t.id)) return; const k = key(t) || '-'; const e = m.get(k) ?? { key: k, qty: 0, count: 0 }; e.qty = sumQty(e.qty, t.qty); e.count++; m.set(k, e) })
  return [...m.values()].sort((a, b) => b.qty - a.qty)
}
