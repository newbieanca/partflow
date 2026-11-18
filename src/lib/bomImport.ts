import { partId } from './slug'
export type RawRow = Record<string, unknown>
export interface Mapping { partCode: string; partName: string; qty: string; unit: string; supplyCategory: string }
export interface ParsedRow { row: number; partCode: string; partName: string; qty: number; unit: string; supplyCategory: string; supplyCategoryId: string; isNewPart: boolean; errors: string[] }
export interface Ctx { supplyCategories: { id: string; name: string }[]; knownPartIds: Set<string>; allowNewParts: boolean }

/** Accepts 2, "2", "0,5" (Indonesian decimal comma) and "0.5". Returns NaN when invalid. */
export function parseQty(v: unknown): number {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim().replace(',', '.')
  return s === '' ? NaN : Number(s)
}
export function validateRows(raw: RawRow[], m: Mapping, ctx: Ctx): ParsedRow[] {
  const seen = new Set<string>()
  const cats = new Map(ctx.supplyCategories.map(c => [c.name.trim().toLowerCase(), c.id]))
  return raw.map((r, i) => {
    const errors: string[] = []
    const partCode = String(r[m.partCode] ?? '').trim()
    const partName = String(r[m.partName] ?? '').trim()
    const unit = String(r[m.unit] ?? '').trim()
    const supplyCategory = String(r[m.supplyCategory] ?? '').trim()
    const qty = parseQty(r[m.qty])
    const pid = partCode ? partId(partCode) : ''
    if (!partCode) errors.push('Kode part kosong')
    if (!partName) errors.push('Nama part kosong')
    if (!unit) errors.push('Unit kosong')
    if (!Number.isFinite(qty) || qty <= 0) errors.push('Qty harus angka lebih dari 0')
    const supplyCategoryId = cats.get(supplyCategory.toLowerCase()) ?? ''
    if (!supplyCategoryId) errors.push(`Supply category "${supplyCategory}" tidak dikenal`)
    if (pid) { if (seen.has(pid)) errors.push('Kode part duplikat di file'); seen.add(pid) }
    const isNewPart = !!pid && !ctx.knownPartIds.has(pid)
    if (isNewPart && !ctx.allowNewParts) errors.push('Part belum ada di master part')
    return { row: i + 2, partCode, partName, qty, unit, supplyCategory, supplyCategoryId, isNewPart, errors }
  })
}
