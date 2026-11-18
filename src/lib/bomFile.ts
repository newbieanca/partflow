import { partId, slug } from './slug'
export type RawRow = Record<string, unknown>
export interface Cols { supplier: string; material: string; desc: string; internal: string; external: string; qty: string; supplyCategory: string }
export interface Line { row: number; partCode: string; partName: string; supplier: string; internalModel: string; qty: number; supplyCategoryId: string }
export interface ModelGroup { model: string; modelId: string; internalModel: string; lines: Line[]; skippedZero: number; signature: string }
export interface ParseResult { groups: ModelGroup[]; errors: { row: number; msg: string }[]; totalRows: number; zeroRows: number }

/** Finds columns by header name (Supplier, Material, Desc, Internal Model, External Model, QTY, Supply Kategori). */
export function detectCols(h: string[]): Cols {
  const f = (test: (s: string) => boolean) => h.find(x => test(x.toLowerCase())) ?? ''
  return {
    supplier: f(s => s.includes('supplier') || s.includes('vendor')),
    material: f(s => s.includes('material') && !s.includes('desc')) || f(s => s.includes('part code') || s.includes('kode')),
    desc: f(s => s.includes('desc') || s.includes('nama')),
    internal: f(s => s.includes('internal')),
    external: f(s => s.includes('external')),
    qty: f(s => s.includes('qty') || s.includes('quantity') || s.includes('jumlah')),
    supplyCategory: f(s => s.includes('supply') || s.includes('kategori') || s.includes('category')),
  }
}
export const requiredCols = (c: Cols) => !!(c.material && c.desc && c.external && c.qty)
/** 2, "2", "0,5" (Indonesian comma) and "0.5" are valid; anything else is NaN. */
export function parseQty(v: unknown): number {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim().replace(',', '.')
  return s === '' ? NaN : Number(s)
}
export const signatureOf = (lines: Pick<Line, 'partCode' | 'qty' | 'supplyCategoryId'>[]) => {
  const s = lines.map(l => `${partId(l.partCode)}|${l.qty}|${l.supplyCategoryId}`).sort().join(';')
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return `${lines.length}-${h.toString(16)}`
}
export function parseBomFile(raw: RawRow[], c: Cols, ctx: { supplyCategories: { id: string; name: string }[] }): ParseResult {
  const cats = new Map(ctx.supplyCategories.map(x => [x.name.trim().toLowerCase(), x.id]))
  const groups = new Map<string, ModelGroup>(); const errors: ParseResult['errors'] = []; const seen = new Set<string>()
  let totalRows = 0, zeroRows = 0
  const str = (r: RawRow, k: string) => (k ? String(r[k] ?? '').trim() : '')
  raw.forEach((r, i) => {
    const row = i + 2
    const partCode = str(r, c.material), model = str(r, c.external), partName = str(r, c.desc)
    if (!partCode && !model && !partName) return // fully empty row
    totalRows++
    const err = (msg: string) => errors.push({ row, msg })
    const qty = parseQty(r[c.qty])
    if (!partCode) return err('Material (kode part) kosong')
    if (!model) return err('External Model kosong')
    if (!partName) return err(`Desc kosong untuk part ${partCode}`)
    if (!Number.isFinite(qty) || qty < 0) return err(`QTY tidak valid untuk ${partCode} (${model})`)
    const catName = str(r, c.supplyCategory); let catId = ''
    if (catName) { catId = cats.get(catName.toLowerCase()) ?? ''; if (!catId) return err(`Supply Kategori "${catName}" tidak dikenal (${partCode})`) }
    const modelId = slug(model); const key = `${modelId}|${partId(partCode)}`
    if (seen.has(key)) return err(`Duplikat: ${partCode} muncul lagi untuk ${model}`)
    seen.add(key)
    let g = groups.get(modelId)
    if (!g) { g = { model, modelId, internalModel: str(r, c.internal), lines: [], skippedZero: 0, signature: '' }; groups.set(modelId, g) }
    if (qty === 0) { g.skippedZero++; zeroRows++; return } // QTY 0 = part not used by this model
    g.lines.push({ row, partCode, partName, supplier: str(r, c.supplier), internalModel: str(r, c.internal), qty, supplyCategoryId: catId })
  })
  const list = [...groups.values()].filter(g => g.lines.length > 0)
  list.forEach(g => { g.signature = signatureOf(g.lines) })
  return { groups: list, errors, totalRows, zeroRows }
}
