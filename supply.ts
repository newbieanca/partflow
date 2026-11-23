import { collection, doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { remainingQty, requiredQty, sumQty } from './bom'
import { decideTake, effectiveQty, lossPackDelta, type TakeMode } from './takeLogic'
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
  const adjRef = doc(db, 'transactionAdjustments', `rev_${a.txId}`); const txRef = doc(db, 'supplyTransactions', a.txId); const lpRef = doc(db, 'transactionAdjustments', `lp_${a.txId}`)
  return runTransaction(db, async t => {
    const [adj, tx, lp] = await Promise.all([t.get(adjRef), t.get(txRef), t.get(lpRef)])
    if (adj.exists()) throw new Error('Transaksi ini sudah dikoreksi')
    if (!tx.exists()) throw new Error('Transaksi tidak ditemukan')
    const x = tx.data(); const totRef = doc(db, 'supplyTotals', `${x.productionId}_${x.partId}`); const eff = effectiveQty(x.qty, lp.exists() ? lp.data().qty : 0) // reverse what is currently counted
    const tot = await t.get(totRef); const before = (tot.data()?.taken as number | undefined) ?? 0; const after = remainingQty(before, eff)
    t.set(adjRef, { type: 'REVERSAL', txId: a.txId, productionId: x.productionId, partId: x.partId, partCode: x.partCode, qty: -eff, reason: a.reason.trim(), before: { taken: before }, after: { taken: after }, txCreatedAt: x.createdAt, userId: a.user.uid, userName: a.user.name, createdAt: serverTimestamp() })
    t.set(totRef, { productionId: x.productionId, partId: x.partId, taken: after, lastKind: 'ADJ', lastId: adjRef.id, updatedAt: serverTimestamp() })
    t.set(doc(collection(db, 'auditLogs')), { userId: a.user.uid, name: a.user.name, action: 'TX_REVERSAL', entityType: 'supplyTransactions', entityId: a.txId, before: { taken: before, qty: eff }, after: { taken: after }, reason: a.reason.trim(), createdAt: serverTimestamp() })
  })
}

/**
 * Loss pack: a box turned out to hold a different quantity than recorded (found later, when the box is empty).
 * The original transaction stays untouched; ONE adjustment document (id lp_<txId>, so it is idempotent and cannot be applied twice)
 * carries the delta + the note, and the running total moves by exactly that delta in the same atomic commit.
 */
export async function correctQty(db: Firestore, a: { txId: string; newQty: number; note: string; user: { uid: string; name: string } }) {
  const note = a.note.trim(); if (note.length < 3) throw new Error('Catatan loss pack wajib diisi')
  const lpRef = doc(db, 'transactionAdjustments', `lp_${a.txId}`); const revRef = doc(db, 'transactionAdjustments', `rev_${a.txId}`); const txRef = doc(db, 'supplyTransactions', a.txId)
  return runTransaction(db, async t => {
    const [lp, rev, tx] = await Promise.all([t.get(lpRef), t.get(revRef), t.get(txRef)])
    if (!tx.exists()) throw new Error('Transaksi tidak ditemukan')
    if (rev.exists()) throw new Error('Transaksi ini sudah dibatalkan')
    if (lp.exists()) throw new Error('Transaksi ini sudah pernah dikoreksi loss pack. Minta Leader untuk koreksi lanjutan.')
    const x = tx.data(); const delta = lossPackDelta(x.qty, a.newQty)
    const totRef = doc(db, 'supplyTotals', `${x.productionId}_${x.partId}`); const tot = await t.get(totRef)
    const before = (tot.data()?.taken as number | undefined) ?? 0; const after = sumQty(before, delta); if (after < 0) throw new Error('Total pengambilan tidak boleh negatif')
    t.set(lpRef, { type: 'LOSS_PACK', txId: a.txId, productionId: x.productionId, partId: x.partId, partCode: x.partCode, qty: delta, note, before: { qty: x.qty }, after: { qty: a.newQty }, txCreatedAt: x.createdAt, userId: a.user.uid, userName: a.user.name, createdAt: serverTimestamp() })
    t.set(totRef, { productionId: x.productionId, partId: x.partId, taken: after, lastKind: 'ADJ', lastId: lpRef.id, updatedAt: serverTimestamp() })
    t.set(doc(collection(db, 'auditLogs')), { userId: a.user.uid, name: a.user.name, action: 'TX_LOSS_PACK', entityType: 'supplyTransactions', entityId: a.txId, before: { qty: x.qty, taken: before }, after: { qty: a.newQty, taken: after }, reason: note, createdAt: serverTimestamp() })
    return { delta }
  })
}
