import { collection, doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { remainingQty, requiredQty, sumQty } from './bom'
import { decideTake, type TakeMode } from './takeLogic'
import type { SnapLine } from './production'
export { OverSupplyError, type OverInfo } from './takeLogic'
export interface TakeInput { idempotencyKey: string; productionId: string; partId: string; mode: TakeMode; qty: number; shift: number; confirmOver: boolean; notes: string; supplyCategoryName: string; user: { uid: string; name: string } }
/**
 * One Firestore transaction: reads production status, the BOM snapshot, the running total and the idempotency doc,
 * recomputes the requirement from those authoritative docs (never from the screen), then writes the transaction + total atomically.
 * The transaction doc id IS the idempotency key, so a retry can never create a second record.
 */
export async function recordTake(db: Firestore, i: TakeInput) {
  if (![1, 2, 3].includes(i.shift)) throw new Error('Pilih shift aktif dulu')
  const txRef = doc(db, 'supplyTransactions', i.idempotencyKey)
  const totRef = doc(db, 'supplyTotals', `${i.productionId}_${i.partId}`)
  return runTransaction(db, async t => {
    const [tx, tot, prod, snap] = await Promise.all([t.get(txRef), t.get(totRef), t.get(doc(db, 'productions', i.productionId)), t.get(doc(db, 'productionBomSnapshots', i.productionId))])
    if (tx.exists()) return { duplicate: true as const, qty: tx.data().qty as number, type: tx.data().type as string }
    if (!prod.exists() || prod.data().status !== 'ACTIVE') throw new Error('Produksi tidak aktif. Pengambilan part tidak bisa dicatat.')
    const line = (snap.data()?.lines as SnapLine[] | undefined)?.find(l => l.partId === i.partId)
    if (!line) throw new Error('Part ini bukan bagian dari BOM produksi tersebut')
    const required = requiredQty(line.qtyPerUnit, prod.data().qty)
    const taken = (tot.data()?.taken as number | undefined) ?? 0
    const d = decideTake(required, taken, i.mode, i.qty, i.confirmOver) // may throw OverSupplyError
    const p = prod.data()
    t.set(txRef, { productionId: i.productionId, productCategoryName: p.productCategoryName, modelId: p.modelId, modelName: p.modelName, lineName: p.lineName, groupName: p.groupName,
      supplyCategoryId: line.supplyCategoryId, supplyCategoryName: i.supplyCategoryName, partId: line.partId, partCode: line.partCode, partName: line.partName, unit: line.unit,
      qty: d.qty, shift: i.shift, type: d.type, notes: i.notes, idempotencyKey: i.idempotencyKey, operatorUid: i.user.uid, operatorName: i.user.name, createdAt: serverTimestamp() })
    t.set(totRef, { productionId: i.productionId, partId: i.partId, taken: sumQty(taken, d.qty), lastKind: 'TX', lastId: i.idempotencyKey, updatedAt: serverTimestamp() })
    return { duplicate: false as const, qty: d.qty, type: d.type as string }
  })
}
/** Correction = reversal record. The original transaction is never edited or deleted; one reversal per transaction (id = rev_<txId>). */
export async function reverseTransaction(db: Firestore, a: { txId: string; reason: string; user: { uid: string; name: string } }) {
  if (a.reason.trim().length < 3) throw new Error('Alasan koreksi wajib diisi')
  const adjRef = doc(db, 'transactionAdjustments', `rev_${a.txId}`); const txRef = doc(db, 'supplyTransactions', a.txId)
  return runTransaction(db, async t => {
    const [adj, tx] = await Promise.all([t.get(adjRef), t.get(txRef)])
    if (adj.exists()) throw new Error('Transaksi ini sudah dikoreksi')
    if (!tx.exists()) throw new Error('Transaksi tidak ditemukan')
    const x = tx.data(); const totRef = doc(db, 'supplyTotals', `${x.productionId}_${x.partId}`)
    const tot = await t.get(totRef); const before = (tot.data()?.taken as number | undefined) ?? 0; const after = remainingQty(before, x.qty)
    t.set(adjRef, { type: 'REVERSAL', txId: a.txId, productionId: x.productionId, partId: x.partId, partCode: x.partCode, qty: -x.qty, reason: a.reason.trim(), before: { taken: before }, after: { taken: after }, txCreatedAt: x.createdAt, userId: a.user.uid, userName: a.user.name, createdAt: serverTimestamp() })
    t.set(totRef, { productionId: x.productionId, partId: x.partId, taken: after, lastKind: 'ADJ', lastId: adjRef.id, updatedAt: serverTimestamp() })
    t.set(doc(collection(db, 'auditLogs')), { userId: a.user.uid, name: a.user.name, action: 'TX_REVERSAL', entityType: 'supplyTransactions', entityId: a.txId, before: { taken: before, qty: x.qty }, after: { taken: after }, reason: a.reason.trim(), createdAt: serverTimestamp() })
  })
}
