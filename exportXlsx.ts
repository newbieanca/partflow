import * as XLSX from 'xlsx'
export function exportXlsx(file: string, rows: Record<string, unknown>[], sheet = 'Data') {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet.slice(0, 31))
  XLSX.writeFile(wb, file.endsWith('.xlsx') ? file : `${file}.xlsx`)
}
