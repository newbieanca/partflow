import { partId } from './slug'
export type RawRow = Record<string, unknown>
export interface Cols { code: string; category: string }
export interface Change { partId: string; code: string; name: string; from: string; to: string }
export interface Plan { changes: Change[]; unchanged: number; ignoredEmpty: number; unknownParts: { row: number; code: string }[]; errors: { row: number; msg: string }[]; totalRows: number }
export function detectCols(headers: string[]): Cols {
  const f = (t: (s: string) => boolean) => headers.find(h => t(h.toLowerCase())) ?? ''
  return { code: f(s => /material|part ?(no|number|code)|kode/.test(s) && !/desc|nama/.test(s)), category: f(s => /supply|kategori|category/.test(s)) }
}
/**
 * Plan category assignments from "part code -> supply category" rows. Nothing is written here.
 * Empty category = part is simply not tracked (row ignored, existing category untouched). Parts not in the part master are reported, never created.
 */
export function planCategories(raw: RawRow[], c: Cols, ctx: { categories: { id: string; name: string }[]; parts: { id: string; code: string; name: string; supplyCategoryId: string }[] }): Plan {
  const cats = new Map(ctx.categories.map(x => [x.name.trim().toLowerCase(), x.id])); const parts = new Map(ctx.parts.map(p => [p.id, p]))
  const seen = new Map<string, { row: number; cat: string }>(); const plan: Plan = { changes: [], unchanged: 0, ignoredEmpty: 0, unknownParts: [], errors: [], totalRows: 0 }
  const str = (r: RawRow, k: string) => (k ? String(r[k] ?? '').trim() : '')
  raw.forEach((r, i) => {
    const row = i + 2, code = str(r, c.code), catName = str(r, c.category)
    if (!code && !catName) return
    plan.totalRows++
    if (!code) return void plan.errors.push({ row, msg: `Kode part kosong (kategori "${catName}")` })
    if (!catName) { plan.ignoredEmpty++; return }
    const to = cats.get(catName.toLowerCase()); if (!to) return void plan.errors.push({ row, msg: `Kategori "${catName}" tidak dikenal (${code})` })
    const id = partId(code); const prev = seen.get(id)
    if (prev) { if (prev.cat !== to) plan.errors.push({ row, msg: `${code} muncul lagi dengan kategori berbeda (baris ${prev.row})` }); return }
    seen.set(id, { row, cat: to })
    const p = parts.get(id); if (!p) return void plan.unknownParts.push({ row, code })
    if (p.supplyCategoryId === to) plan.unchanged++; else plan.changes.push({ partId: id, code: p.code, name: p.name, from: p.supplyCategoryId, to })
  })
  return plan
}
