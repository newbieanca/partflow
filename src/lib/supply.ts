import { doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { remainingQty } from './bom'
export interface TakeInput { idempotencyKey: string; productionId: string; partId: string; qty: number; shift: 1|2|3; confirmOver: boolean; required: number; snapshot: Record<string, unknown>; user: { uid: string; name: string } }
/** Atomic take: transaction doc id = idempotency key (retry-safe), running total read+written in the same Firestore transaction. */
export async function recordTake(db: Firestore, i: TakeInput) {
  if (!(i.qty > 0)) throw new Error('Quantity must be greater than 0')
  const txRef = doc(db, 'supplyTransactions', i.idempotencyKey)
  const totRef = doc(db, 'supplyTotals', `${i.productionId}_${i.partId}`)
  const prodRef = doc(db, 'productions', i.productionId)
  return runTransaction(db, async t => {
    const [existing, tot, prod] = await Promise.all([t.get(txRef), t.get(totRef), t.get(prodRef)])
    if (existing.exists()) return { duplicate: true as const }
    if (!prod.exists() || prod.data().status !== 'ACTIVE') throw new Error('Production is not ACTIVE')
    const taken = (tot.data()?.taken as number | undefined) ?? 0
    const remaining = remainingQty(i.required, taken)
    const over = i.qty > remaining
    if (over && !i.confirmOver) throw Object.assign(new Error('OVER_SUPPLY_CONFIRMATION_REQUIRED'), { required: i.required, taken, remaining, excess: i.qty - remaining })
    t.set(txRef, { ...i.snapshot, productionId: i.productionId, partId: i.partId, qty: i.qty, shift: i.shift, type: over ? 'OVER_SUPPLY' : 'PARTIAL', operatorUid: i.user.uid, operatorName: i.user.name, createdAt: serverTimestamp() })
    t.set(totRef, { productionId: i.productionId, partId: i.partId, taken: taken + i.qty, updatedAt: serverTimestamp() })
    return { duplicate: false as const }
  })
}
