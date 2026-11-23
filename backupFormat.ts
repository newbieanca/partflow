// Lossless JSON format for backups: Firestore Timestamps become { __ts: ISO }. Kept identical to scripts/backupFormat.mjs.
export const BACKUP_COLLECTIONS = ['users', 'productCategories', 'supplyCategories', 'productionLines', 'operatorGroups', 'shifts', 'models', 'parts', 'bomHeaders', 'bomDetails', 'productions', 'productionBomSnapshots', 'supplyTransactions', 'supplyTotals', 'transactionAdjustments', 'auditLogs', 'appSettings']
export const EXCEL_SKIP = new Set(['productionBomSnapshots', 'supplyTotals']) // too large for a spreadsheet cell / derived data
export function encode(v: unknown): unknown {
  if (v == null) return v
  if (typeof (v as { toDate?: unknown }).toDate === 'function') return { __ts: (v as { toDate(): Date }).toDate().toISOString() }
  if (v instanceof Date) return { __ts: v.toISOString() }
  if (Array.isArray(v)) return v.map(encode)
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, encode(x)]))
  return v
}
/** One spreadsheet row per document. Nested values become JSON text (Excel cells hold at most 32,767 characters). */
export function flatten(id: string, data: Record<string, unknown>): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = { id }
  for (const [k, raw] of Object.entries(encode(data) as Record<string, unknown>)) {
    if (raw == null) row[k] = ''
    else if (typeof raw === 'object' && '__ts' in (raw as object)) row[k] = (raw as { __ts: string }).__ts
    else if (typeof raw === 'object') row[k] = JSON.stringify(raw).slice(0, 32000)
    else row[k] = raw as string | number | boolean
  }
  return row
}
