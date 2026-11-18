import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { doc, writeBatch, serverTimestamp, type DocumentReference } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { partId } from '../lib/slug'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import { validateRows, type Mapping, type RawRow } from '../lib/bomImport'
interface Named { name: string; active?: boolean }
interface Header { modelId: string; version: number; active: boolean }
const FIELDS: { k: keyof Mapping; label: string; hints: string[] }[] = [
  { k: 'partCode', label: 'Kode part', hints: ['code', 'kode', 'part no', 'part number'] },
  { k: 'partName', label: 'Nama part', hints: ['name', 'nama', 'description'] },
  { k: 'qty', label: 'Qty per unit', hints: ['qty', 'quantity', 'jumlah', 'usage'] },
  { k: 'unit', label: 'Unit', hints: ['unit', 'uom', 'satuan'] },
  { k: 'supplyCategory', label: 'Supply category', hints: ['supply', 'category', 'kategori'] }]
const guess = (headers: string[], hints: string[]) => headers.find(h => hints.some(x => h.toLowerCase().includes(x))) ?? ''
export default function BomImport() {
  const { user } = useAuth()
  const models = useCollection<Named>('models'); const cats = useCollection<Named>('supplyCategories')
  const parts = useCollection<{ code: string }>('parts'); const boms = useCollection<Header>('bomHeaders')
  const [modelId, setModelId] = useState(''); const [wb, setWb] = useState<XLSX.WorkBook | null>(null); const [sheet, setSheet] = useState('')
  const [rows, setRows] = useState<RawRow[]>([]); const [map, setMap] = useState<Mapping>({ partCode: '', partName: '', qty: '', unit: '', supplyCategory: '' })
  const [allowNew, setAllowNew] = useState(false); const [confirm, setConfirm] = useState(false); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const headers = rows[0] ? Object.keys(rows[0]) : []
  const loadSheet = (w: XLSX.WorkBook, name: string) => {
    const r = XLSX.utils.sheet_to_json<RawRow>(w.Sheets[name], { defval: '' }); const h = r[0] ? Object.keys(r[0]) : []
    setSheet(name); setRows(r); setMap({ partCode: guess(h, FIELDS[0].hints), partName: guess(h, FIELDS[1].hints), qty: guess(h, FIELDS[2].hints), unit: guess(h, FIELDS[3].hints), supplyCategory: guess(h, FIELDS[4].hints) })
  }
  const onFile = async (file?: File) => {
    if (!file) return; setMsg('')
    try { const w = XLSX.read(await file.arrayBuffer(), { type: 'array' }); setWb(w); loadSheet(w, w.SheetNames[0]) } catch { setMsg('File tidak bisa dibaca. Gunakan .xlsx atau .xls') }
  }
  const parsed = useMemo(() => Object.values(map).every(Boolean) ? validateRows(rows, map, { supplyCategories: cats.items, knownPartIds: new Set(parts.items.map(p => p.id)), allowNewParts: allowNew }) : [], [rows, map, cats.items, parts.items, allowNew])
  const bad = parsed.filter(p => p.errors.length).length
  const nextVersion = boms.items.filter(h => h.modelId === modelId).reduce((m, h) => Math.max(m, h.version), 0) + 1
  const modelName = models.items.find(m => m.id === modelId)?.name ?? ''
  const doImport = async () => {
    setBusy(true); setMsg('')
    try {
      const bomId = `${modelId}_v${nextVersion}`; const ops: { ref: DocumentReference; data: Record<string, unknown> }[] = []
      for (const p of parsed) {
        const pid = partId(p.partCode)
        if (p.isNewPart) ops.push({ ref: doc(db, 'parts', pid), data: { code: p.partCode.toUpperCase(), name: p.partName, unit: p.unit, supplyCategoryId: p.supplyCategoryId, description: '', active: true, createdAt: serverTimestamp() } })
        ops.push({ ref: doc(db, 'bomDetails', `${bomId}_${pid}`), data: { bomId, modelId, partId: pid, partCode: p.partCode.toUpperCase(), partName: p.partName, qtyPerUnit: p.qty, unit: p.unit, supplyCategoryId: p.supplyCategoryId } })
      }
      // Header is written LAST: if an earlier chunk fails, no header points to a half-imported BOM.
      for (let i = 0; i < ops.length; i += 400) { const b = writeBatch(db); ops.slice(i, i + 400).forEach(o => b.set(o.ref, o.data)); await b.commit() }
      const header = { modelId, version: nextVersion, active: false, lineCount: parsed.length, createdBy: user!.uid, createdAt: serverTimestamp() }
      await writeBatch(db).set(doc(db, 'bomHeaders', bomId), header).commit()
      await audit(user!, 'BOM_IMPORT', 'bomHeaders', bomId, null, { modelId, version: nextVersion, lines: parsed.length, newParts: parsed.filter(p => p.isNewPart).length })
      setMsg(`Berhasil: BOM ${modelName} versi ${nextVersion} (${parsed.length} baris, ${parsed.filter(p => p.isNewPart).length} part baru). Status: belum aktif.`)
      setRows([]); setWb(null); setConfirm(false)
    } catch (e) { setMsg('Gagal: ' + (e as Error).message) } finally { setBusy(false) }
  }
  const versions = boms.items.filter(h => h.modelId === modelId).sort((a, b) => b.version - a.version)
  const activate = async (v: Header) => {
    const b = writeBatch(db); versions.forEach(h => b.update(doc(db, 'bomHeaders', `${modelId}_v${h.version}`), { active: h.version === v.version })); await b.commit()
    await audit(user!, 'BOM_ACTIVATE', 'bomHeaders', `${modelId}_v${v.version}`, null, { active: true })
  }
  return <div className="space-y-4"><h2 className="text-lg font-bold">Impor BOM dari Excel</h2>
    <select className="w-full border rounded-lg p-3" value={modelId} onChange={e => setModelId(e.target.value)}><option value="">Pilih model…</option>{models.items.filter(m => m.active !== false).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
    {modelId && <>
      {versions.length > 0 && <ul className="bg-white rounded-xl shadow divide-y">{versions.map(v => <li key={v.version} className="p-3 flex gap-3 items-center"><span className="flex-1">Versi {v.version} {v.active && <b className="text-green-600">· AKTIF</b>}</span>{!v.active && <button className="underline text-sm" onClick={() => activate(v)}>Aktifkan</button>}</li>)}</ul>}
      <input type="file" accept=".xlsx,.xls" onChange={e => onFile(e.target.files?.[0])} />
      {wb && wb.SheetNames.length > 1 && <select className="border rounded-lg p-2" value={sheet} onChange={e => loadSheet(wb, e.target.value)}>{wb.SheetNames.map(s => <option key={s}>{s}</option>)}</select>}
      {rows.length > 0 && <>
        <div className="grid gap-2 sm:grid-cols-2">{FIELDS.map(f => <label key={f.k} className="text-sm">{f.label}<select className="w-full border rounded-lg p-2" value={map[f.k]} onChange={e => setMap({ ...map, [f.k]: e.target.value })}><option value="">—</option>{headers.map(h => <option key={h}>{h}</option>)}</select></label>)}</div>
        <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={allowNew} onChange={e => setAllowNew(e.target.checked)} /> Buat part baru otomatis untuk kode yang belum ada di master part</label>
        {parsed.length > 0 && <>
          <p className={bad ? 'text-red-600' : 'text-green-700'}>{parsed.length} baris · {bad} bermasalah · {parsed.filter(p => p.isNewPart).length} part baru</p>
          <div className="overflow-x-auto bg-white rounded-xl shadow"><table className="text-sm w-full"><thead><tr className="text-left"><th className="p-2">Baris</th><th>Kode</th><th>Nama</th><th>Qty</th><th>Unit</th><th>Supply</th><th>Status</th></tr></thead>
            <tbody>{parsed.slice(0, 300).map(p => <tr key={p.row} className={p.errors.length ? 'bg-red-50' : ''}><td className="p-2">{p.row}</td><td>{p.partCode}</td><td>{p.partName}</td><td>{p.qty}</td><td>{p.unit}</td><td>{p.supplyCategory}</td><td className="text-red-600">{p.errors.join('; ') || (p.isNewPart ? 'part baru' : 'OK')}</td></tr>)}</tbody></table></div>
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} /> Saya konfirmasi membuat BOM {modelName} versi {nextVersion} (BOM lama tidak diubah; versi baru belum aktif)</label>
          <button disabled={!!bad || !confirm || busy} className="w-full bg-blue-600 disabled:opacity-40 text-white rounded-lg p-3 font-semibold" onClick={doImport}>{busy ? 'Mengimpor…' : 'Impor BOM'}</button></>}</>}</>}
    {msg && <p className="font-medium">{msg}</p>}</div>
}
