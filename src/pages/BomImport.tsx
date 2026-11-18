import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { doc, writeBatch, serverTimestamp, type DocumentReference } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { partId } from '../lib/slug'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import { detectCols, parseBomFile, requiredCols, type Cols, type RawRow } from '../lib/bomFile'
interface Named { name: string; active?: boolean }
interface Header { modelId: string; version: number; active: boolean; signature?: string }
const LABELS: [keyof Cols, string, boolean][] = [['material', 'Material (kode part)', true], ['desc', 'Desc (nama part)', true], ['external', 'External Model', true], ['qty', 'QTY', true], ['supplyCategory', 'Supply Kategori', false], ['internal', 'Internal Model', false], ['supplier', 'Supplier', false]]
type Op = { ref: DocumentReference; data: Record<string, unknown> }
export default function BomImport() {
  const { user } = useAuth()
  const models = useCollection<Named>('models'); const cats = useCollection<Named>('supplyCategories')
  const parts = useCollection<{ code: string }>('parts'); const boms = useCollection<Header>('bomHeaders')
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null); const [sheet, setSheet] = useState(''); const [rows, setRows] = useState<RawRow[]>([])
  const [cols, setCols] = useState<Cols>(detectCols([])); const [showMap, setShowMap] = useState(false)
  const [autoActive, setAutoActive] = useState(true); const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('')
  const headers = rows[0] ? Object.keys(rows[0]) : []
  const loadSheet = (w: XLSX.WorkBook, name: string) => { const r = XLSX.utils.sheet_to_json<RawRow>(w.Sheets[name], { defval: '' }); setSheet(name); setRows(r); setCols(detectCols(r[0] ? Object.keys(r[0]) : [])); setConfirm(false) }
  const onFile = async (file?: File) => {
    if (!file) return; setMsg('')
    try { const w = XLSX.read(await file.arrayBuffer(), { type: 'array' }); setWb(w); loadSheet(w, w.SheetNames[0]) } catch { setMsg('File tidak bisa dibaca. Gunakan .xlsx atau .xls') }
  }
  const ok = requiredCols(cols)
  const result = useMemo(() => ok ? parseBomFile(rows, cols, { supplyCategories: cats.items }) : null, [rows, cols, ok, cats.items])
  const plan = useMemo(() => (result?.groups ?? []).map(g => {
    const hs = boms.items.filter(h => h.modelId === g.modelId); const latest = hs.reduce<Header | null>((m, h) => !m || h.version > m.version ? h : m, null)
    const unchanged = !!latest && latest.signature === g.signature
    return { g, hs, unchanged, version: unchanged ? latest!.version : (latest?.version ?? 0) + 1, isNewModel: !models.items.some(m => m.id === g.modelId) }
  }), [result, boms.items, models.items])
  const newParts = useMemo(() => { const m = new Map<string, { code: string; name: string; supplier: string; cat: string }>(); const known = new Set(parts.items.map(p => p.id))
    plan.forEach(p => p.g.lines.forEach(l => { const id = partId(l.partCode); if (!known.has(id) && !m.has(id)) m.set(id, { code: l.partCode.toUpperCase(), name: l.partName, supplier: l.supplier, cat: l.supplyCategoryId }) })); return m }, [plan, parts.items])
  const toWrite = plan.filter(p => !p.unchanged); const noCat = toWrite.reduce((n, p) => n + p.g.lines.filter(l => !l.supplyCategoryId).length, 0)
  const commit = async (ops: Op[]) => { for (let i = 0; i < ops.length; i += 400) { const b = writeBatch(db); ops.slice(i, i + 400).forEach(o => b.set(o.ref, o.data, { merge: false })); await b.commit() } }
  const run = async () => {
    setMsg(''); let done = 0
    try {
      setBusy('Menyimpan model dan master part…')
      await commit([...plan.filter(p => p.isNewModel).map(p => ({ ref: doc(db, 'models', p.g.modelId), data: { name: p.g.model, internalModel: p.g.internalModel, productCategoryId: '', active: true, createdAt: serverTimestamp() } })),
        ...[...newParts].map(([id, p]) => ({ ref: doc(db, 'parts', id), data: { code: p.code, name: p.name, unit: 'PCS', supplier: p.supplier, supplyCategoryId: p.cat, description: '', active: true, createdAt: serverTimestamp() } }))])
      for (const p of toWrite) {
        setBusy(`Mengimpor BOM ${p.g.model} (${done + 1}/${toWrite.length})…`)
        const bomId = `${p.g.modelId}_v${p.version}`
        await commit(p.g.lines.map(l => ({ ref: doc(db, 'bomDetails', `${bomId}_${partId(l.partCode)}`), data: { bomId, modelId: p.g.modelId, partId: partId(l.partCode), partCode: l.partCode.toUpperCase(), partName: l.partName, supplier: l.supplier, qtyPerUnit: l.qty, unit: 'PCS', supplyCategoryId: l.supplyCategoryId } })))
        // Header last: a failed import never leaves a header pointing at a partial BOM.
        const b = writeBatch(db)
        if (autoActive) p.hs.forEach(h => b.update(doc(db, 'bomHeaders', `${p.g.modelId}_v${h.version}`), { active: false }))
        b.set(doc(db, 'bomHeaders', bomId), { modelId: p.g.modelId, version: p.version, active: autoActive, signature: p.g.signature, lineCount: p.g.lines.length, createdBy: user!.uid, createdAt: serverTimestamp() })
        await b.commit(); done++
      }
      await audit(user!, 'BOM_IMPORT', 'bomHeaders', 'bulk', null, { models: done, unchanged: plan.length - done, newParts: newParts.size, newModels: plan.filter(p => p.isNewModel).length })
      setMsg(`Berhasil: ${done} BOM baru, ${plan.length - done} model tidak berubah, ${newParts.size} part baru.`); setRows([]); setWb(null); setConfirm(false)
    } catch (e) { setMsg(`Berhenti setelah ${done} model berhasil. Error: ${(e as Error).message}. Impor ulang file yang sama: model yang sudah masuk akan dilewati.`) } finally { setBusy('') }
  }
  const activate = async (modelId: string, hs: Header[], v: number) => { const b = writeBatch(db); hs.forEach(h => b.update(doc(db, 'bomHeaders', `${modelId}_v${h.version}`), { active: h.version === v })); await b.commit(); await audit(user!, 'BOM_ACTIVATE', 'bomHeaders', `${modelId}_v${v}`, null, { active: true }) }
  const byModel = useMemo(() => { const m = new Map<string, Header[]>(); boms.items.forEach(h => m.set(h.modelId, [...(m.get(h.modelId) ?? []), h])); return [...m] }, [boms.items])
  return <div className="space-y-4"><h2 className="text-lg font-bold">Upload BOM (Excel)</h2>
    <p className="text-sm text-slate-600">Satu file untuk semua model. Kolom dibaca dari judul: Supplier, Material, Desc, Internal Model, External Model, QTY, Supply Kategori. QTY 0 dilewati (part tidak dipakai).</p>
    <input type="file" accept=".xlsx,.xls" onChange={e => onFile(e.target.files?.[0])} />
    {wb && wb.SheetNames.length > 1 && <select className="border rounded-lg p-2" value={sheet} onChange={e => loadSheet(wb, e.target.value)}>{wb.SheetNames.map(s => <option key={s}>{s}</option>)}</select>}
    {rows.length > 0 && <>
      {(!ok || showMap) ? <div className="grid gap-2 sm:grid-cols-2 bg-white rounded-xl shadow p-3">{LABELS.map(([k, label, req]) => <label key={k} className="text-sm">{label}{req && ' *'}<select className="w-full border rounded-lg p-2" value={cols[k]} onChange={e => setCols({ ...cols, [k]: e.target.value })}><option value="">—</option>{headers.map(h => <option key={h}>{h}</option>)}</select></label>)}</div>
        : <button className="underline text-sm" onClick={() => setShowMap(true)}>Kolom sudah terdeteksi otomatis. Ubah?</button>}
      {!ok && <p className="text-red-600">Pilih kolom yang bertanda *.</p>}
      {result && <>
        <div className="bg-white rounded-xl shadow p-3 text-sm space-y-1">
          <p><b>{result.totalRows}</b> baris · <b>{result.groups.length}</b> model · <b>{result.zeroRows}</b> baris QTY 0 dilewati · <b className={result.errors.length ? 'text-red-600' : ''}>{result.errors.length}</b> baris bermasalah</p>
          <p>{newParts.size} part baru akan dibuat di master part · {plan.filter(p => p.isNewModel).length} model baru · unit part diisi PCS</p>
          {noCat > 0 && <p className="text-orange-600">{noCat} baris BOM belum punya Supply Kategori (kolom G kosong). Tetap bisa diimpor; isi kolom G lalu upload ulang untuk membuat versi baru.</p>}</div>
        {result.errors.length > 0 && <ul className="bg-red-50 rounded-xl p-3 text-sm text-red-700 max-h-60 overflow-auto">{result.errors.slice(0, 100).map((e, i) => <li key={i}>Baris {e.row}: {e.msg}</li>)}{result.errors.length > 100 && <li>…dan {result.errors.length - 100} lainnya</li>}</ul>}
        <div className="overflow-x-auto bg-white rounded-xl shadow"><table className="text-sm w-full"><thead><tr className="text-left"><th className="p-2">Model</th><th>Part dipakai</th><th>QTY 0</th><th>Hasil</th></tr></thead>
          <tbody>{plan.slice(0, 300).map(p => <tr key={p.g.modelId}><td className="p-2">{p.g.model}{p.isNewModel && <em className="text-blue-600"> · baru</em>}</td><td>{p.g.lines.length}</td><td>{p.g.skippedZero}</td><td>{p.unchanged ? 'Tidak berubah (dilewati)' : `Versi ${p.version}`}</td></tr>)}</tbody></table></div>
        <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={autoActive} onChange={e => setAutoActive(e.target.checked)} /> Langsung aktifkan versi baru (produksi yang sudah berjalan tidak terpengaruh)</label>
        <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} /> Saya konfirmasi data di atas benar. BOM lama tidak ditimpa, versi baru dibuat.</label>
        <button disabled={result.errors.length > 0 || !confirm || !!busy || toWrite.length === 0} className="w-full bg-blue-600 disabled:opacity-40 text-white rounded-lg p-3 font-semibold" onClick={run}>{busy || (toWrite.length === 0 ? 'Tidak ada perubahan' : `Impor ${toWrite.length} BOM`)}</button>
        {result.errors.length > 0 && <p className="text-sm text-red-600">Perbaiki baris bermasalah di Excel lalu upload ulang.</p>}</>}</>}
    {msg && <p className="font-medium">{msg}</p>}
    {byModel.length > 0 && <div><h3 className="font-bold mt-4">BOM per model</h3><ul className="bg-white rounded-xl shadow divide-y">{byModel.sort((a, b) => a[0].localeCompare(b[0])).slice(0, 300).map(([id, hs]) => { const act = hs.find(h => h.active); const last = hs.reduce((m, h) => h.version > m.version ? h : m)
      return <li key={id} className="p-3 flex gap-3 items-center"><span className="flex-1">{models.items.find(m => m.id === id)?.name ?? id}</span><span className="text-sm">{act ? `Aktif: v${act.version}` : 'Belum ada versi aktif'}</span>{(!act || act.version !== last.version) && <button className="underline text-sm" onClick={() => activate(id, hs, last.version)}>Aktifkan v{last.version}</button>}</li> })}</ul></div>}
  </div>
}
