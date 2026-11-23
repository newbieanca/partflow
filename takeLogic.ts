import { remainingQty, sumQty } from './bom'
export type TakeMode = 'TAKE_ALL' | 'PARTIAL'
export interface OverInfo { required: number; taken: number; remaining: number; excess: number }
export class OverSupplyError extends Error { constructor(public info: OverInfo) { super('OVER_SUPPLY_CONFIRMATION_REQUIRED'); this.name = 'OverSupplyError' } }
/** Pure decision used inside the Firestore transaction, with values read at commit time. */
export function decideTake(required: number, taken: number, mode: TakeMode, qty: number, confirmOver: boolean) {
  const remaining = remainingQty(required, taken)
  const q = mode === 'TAKE_ALL' ? Math.max(0, remaining) : qty // Take All = CURRENT remaining, never the original requirement
  if (!Number.isFinite(q) || q <= 0) throw new Error(mode === 'TAKE_ALL' ? 'Tidak ada sisa kebutuhan untuk diambil' : 'Jumlah harus lebih dari 0')
  const excess = -remainingQty(required, sumQty(taken, q))
  const over = excess > 0
  if (over && !confirmOver) throw new OverSupplyError({ required, taken, remaining, excess })
  return { qty: q, type: (over ? 'OVER_SUPPLY' : mode) as 'OVER_SUPPLY' | TakeMode, remaining }
}

/** Loss pack: the recorded quantity turns out to differ from what was actually in the box. Returns actual - recorded (negative = box was short). */
export function lossPackDelta(recorded: number, actual: number) {
  if (!Number.isFinite(actual) || actual < 0) throw new Error('Qty aktual tidak valid')
  const d = remainingQty(actual, recorded)
  if (d === 0) throw new Error('Qty aktual sama dengan yang tercatat')
  return d
}
/** Effective quantity of a transaction = recorded quantity + its (single) loss-pack delta. The original record is never modified. */
export const effectiveQty = (recorded: number, delta = 0) => sumQty(recorded, delta)
