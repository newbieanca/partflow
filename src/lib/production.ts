import { requiredQty, remainingQty } from './bom'
export interface SnapLine { partId: string; partCode: string; partName: string; qtyPerUnit: number; unit: string; supplyCategoryId: string }
export interface ProdForm { modelId: string; lineId: string; groupId: string; qty: number; date: string }
export const todayStr = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD, local date
export function validateProduction(f: ProdForm): string[] {
  const e: string[] = []
  if (!f.modelId) e.push('Pilih model dari daftar')
  if (!f.lineId) e.push('Pilih line')
  if (!f.groupId) e.push('Pilih group')
  if (!Number.isInteger(f.qty) || f.qty <= 0) e.push('Jumlah produksi harus bilangan bulat lebih dari 0')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.push('Tanggal tidak valid')
  return e
}
/** Parts whose already-taken quantity would exceed the requirement if production qty becomes newQty. */
export function overSupplyAfterChange(lines: SnapLine[], newQty: number, taken: Record<string, number>) {
  return lines.flatMap(l => {
    const required = requiredQty(l.qtyPerUnit, newQty); const t = taken[l.partId] ?? 0; const rem = remainingQty(required, t)
    return rem < 0 ? [{ partId: l.partId, partCode: l.partCode, partName: l.partName, required, taken: t, excess: -rem }] : []
  })
}
