import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { useAuth } from '../auth/AuthContext'
import { audit } from '../lib/audit'
import { detectCols, planCategories, type RawRow } from '../lib/partCategoryFile'
import { ErrorNote, Pill } from '../ui'
interface Part { code: string; name: string; supplyCategoryId: string }
export default function PartCategories() {
  const { user } = useAuth(); const parts = useCollection<Part>('parts'); const cats = useCollection<{ name: string }>('supplyCategories')
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null); const [sheet, setSheet] = useState(''); const [rows, setRows] = useState<RawRow[]>([]); const [fileName, setFileName] = useState('')
  const [cols, setCols] = useState({ code: '', category: '' }); const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const headers = rows[0] ? Object.keys(rows[0]) : []
  const loadSheet = (w: XLSX.WorkBook, name: string) => { const r = XLSX.utils.sheet_to_json<RawRow>(w.Sheets[name], { defval: '' }); setSheet(name); setRows(r); setCols(detectCols(r[0] ? Object.keys(r[0]) : [])); setConfirm(false) }
  const onFile = async (f?: File) => { if (!f) return; setMsg(''); setFileName(f.name); try { const w = XLSX.read(await f.arrayBuffer(), { type: 'array' }); setWb(w); loadSheet(w, w.SheetNames[0]) } catch { setMsg('File tidak bisa dibaca. Gunakan .xlsx atau .xls') } }
  const plan = useMemo(() => cols.code && cols.category ? planCategories(rows, cols, { categories: cats.items, parts: parts.items.map(p => ({ id: p.id, code: p.code, name: p.name, supplyCategoryId: p.supplyCategoryId })) }) : null, [rows, cols, cats.items, parts.items])
  const catName = (id: string) => cats.items.find(c => c.id === id)?.name ?? 'Tidak dicatat'
  const tracked = parts.items.filter(p => !!p.supplyCategoryId).length
  const apply = async () => {
    if (!plan) return; setBusy(true); setMsg('')
    try {
      for (let i = 0; i < plan.changes.length; i += 400) { const b = writeBatch(db); plan.changes.slice(i, i + 400).forEach(c => b.update(doc(db, 'parts', c.partId), { supplyCategoryId: c.to, updatedAt: serverTimestamp() })); await b.commit() }
      await audit(user!, 'PART_CATEGORY_IMPORT', 'parts', 'bulk', null, { changed: plan.changes.length, unchanged: plan.unchanged, file: fileName })
      setMsg(`Berhasil: ${plan.changes.length} part diberi kategori. Produksi yang dibuat setelah ini memakai kategori baru.`); setRows([]); setWb(null); setFileName(''); setConfirm(false)
    } catch (e) { setMsg(`Gagal: ${(e as Error).message}. Unggah ulang file yang sama; part yang sudah berubah akan dilewati.`) } finally { setBusy(false) }
  }
  return <div>
    <p className="text-sm text-mute mb-1">Isi kategori supply per kode part dari satu daftar Excel. Part tanpa kategori <b className="text-ink2">tidak dicatat</b> di aplikasi (tidak muncul di Supply, dashboard, maupun laporan).</p>
    <p className="text-sm text-mute mb-4 num">Saat ini {tracked} dari {parts.items.length} part berkategori (dicatat).</p>
    <div className="surface border-dashed !border-2 !border-ink2/30 p-6 text-center mb-4"><UploadCloud className="mx-auto text-sharp" size={32} /><p className="font-semibold mt-2">Pilih file Excel: kolom kode part dan kategori supply</p>
      <label className="btn btn-primary btn-lg mt-3 cursor-pointer">Pilih file Excel<input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} /></label>
      <p className="text-sm text-mute mt-2 flex items-center justify-center gap-1">{fileName ? <><FileSpreadsheet size={16} />{fileName}</> : 'Belum ada file dipilih'}</p>
      {wb && wb.SheetNames.length > 1 && <select aria-label="Sheet" className="input !w-auto mt-3" value={sheet} onChange={e => loadSheet(wb, e.target.value)}>{wb.SheetNames.map(s => <option key={s}>{s}</option>)}</select>}</div>
    {rows.length > 0 && <>
      <div className="surface p-3 mb-4 grid gap-2 grid-cols-2">{([['code', 'Kolom kode part'], ['category', 'Kolom kategori supply']] as const).map(([k, l]) => <div key={k}><label className="label">{l} *</label><select className="input" value={cols[k]} onChange={e => setCols({ ...cols, [k]: e.target.value })}><option value="">—</option>{headers.map(h => <option key={h}>{h}</option>)}</select></div>)}</div>
      {plan && <>
        <div className="surface mb-4 grid grid-cols-2 sm:grid-cols-4 text-center">{[['Baris', plan.totalRows, ''], ['Akan diubah', plan.changes.length, 'text-ok'], ['Sudah sama', plan.unchanged, ''], ['Bermasalah', plan.errors.length, plan.errors.length ? 'text-bad' : '']].map(([l, v, c], i) => <div key={l as string} className={`py-3 ${i % 2 ? 'border-l border-line' : ''} ${i > 1 ? 'border-t sm:border-t-0 border-line' : ''} ${i > 0 ? 'sm:border-l' : ''}`}><p className={`text-2xl font-bold num ${c}`}>{v}</p><p className="text-xs text-mute">{l}</p></div>)}</div>
        {plan.ignoredEmpty > 0 && <p className="text-sm text-ink2 bg-canvas rounded-lg p-3 mb-3">{plan.ignoredEmpty} baris tanpa kategori diabaikan (part tidak dicatat; kategori yang sudah ada tidak dihapus).</p>}
        {plan.unknownParts.length > 0 && <details className="bg-amber-50 rounded-lg p-3 mb-3 text-sm text-amber-900"><summary className="cursor-pointer font-medium">{plan.unknownParts.length} kode tidak ada di master part (dilewati). Klik untuk lihat.</summary><p className="mt-1">{plan.unknownParts.slice(0, 100).map(u => `${u.code} (baris ${u.row})`).join(', ')}</p></details>}
        {plan.errors.length > 0 && <div className="mb-3"><ErrorNote>{plan.errors.length} baris bermasalah. Perbaiki di Excel lalu unggah ulang.</ErrorNote><ul className="surface mt-2 p-3 text-sm text-bad max-h-60 overflow-auto">{plan.errors.slice(0, 100).map((e, i) => <li key={i}>Baris {e.row}: {e.msg}</li>)}</ul></div>}
        {plan.changes.length > 0 && <div className="surface overflow-x-auto mb-4"><table className="tbl"><thead><tr><th>Kode</th><th>Nama</th><th>Kategori</th></tr></thead><tbody>{plan.changes.slice(0, 200).map(c => <tr key={c.partId}><td className="font-semibold num">{c.code}</td><td>{c.name}</td><td className="whitespace-nowrap"><span className="text-mute">{c.from ? catName(c.from) : 'Tidak dicatat'}</span> → <Pill tone="ok">{catName(c.to)}</Pill></td></tr>)}</tbody></table></div>}
        {plan.changes.length > 200 && <p className="text-xs text-mute mb-3 px-1">Menampilkan 200 pertama dari {plan.changes.length}.</p>}
        <label className="flex gap-3 items-start text-sm mb-4"><input type="checkbox" className="mt-0.5 w-5 h-5 accent-[#E60012]" checked={confirm} onChange={e => setConfirm(e.target.checked)} />Saya konfirmasi perubahan di atas benar. Produksi yang sudah dibuat tidak berubah; hanya produksi baru yang memakai kategori ini.</label>
        <button disabled={plan.errors.length > 0 || !confirm || busy || plan.changes.length === 0} className="btn btn-primary btn-lg w-full" onClick={apply}>{busy ? 'Menyimpan…' : plan.changes.length === 0 ? 'Tidak ada perubahan' : `Terapkan ${plan.changes.length} perubahan`}</button></>}</>}
    {msg && <p className="font-medium bg-white border border-line rounded-lg p-3 mt-4">{msg}</p>}</div>
}
