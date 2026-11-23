import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { doc, writeBatch, serverTimestamp, type DocumentReference } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { partId } from '../lib/slug'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'
import { Empty, ErrorNote, Pill } from '../ui'
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
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [fileName, setFileName] = useState('')
  const headers = rows[0] ? Object.keys(rows[0]) : []
  const loadSheet = (w: XLSX.WorkBook, name: string) => { const r = XLSX.utils.sheet_to_json<RawRow>(w.Sheets[name], { defval: '' }); setSheet(name); setRows(r); setCols(detectCols(r[0] ? Object.keys(r[0]) : [])); setConfirm(false) }
  const onFile = async (file?: File) => {
    if (!file) return; setMsg(''); setFileName(file.name)
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
  return <div>
    <p className="text-sm text-mute mb-4">Satu file untuk semua model. Kolom dibaca dari judulnya: Supplier, Material, Desc, Internal Model, External Model, QTY, Supply Kategori. QTY 0 dilewati.</p>
    <div className="surface border-dashed !border-2 !border-ink2/30 p-6 text-center mb-4"><UploadCloud className="mx-auto text-sharp" size={32} /><p className="font-semibold mt-2">Langkah 1: pilih file Excel BOM</p>
      <label className="btn btn-primary btn-lg mt-3 cursor-pointer">Pilih file Excel<input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} /></label>
      <p className="text-sm text-mute mt-2 flex items-center justify-center gap-1">{fileName ? <><FileSpreadsheet size={16} />{fileName}</> : 'Belum ada file dipilih (.xlsx / .xls)'}</p>
      {wb && wb.SheetNames.length > 1 && <select aria-label="Sheet" className="input !w-auto mt-3" value={sheet} onChange={e => loadSheet(wb, e.target.value)}>{wb.SheetNames.map(s => <option key={s}>{s}</option>)}</select>}</div>
    {rows.length > 0 && <>
      {(!ok || showMap) ? <div className="surface p-3 mb-4 grid gap-2 sm:grid-cols-2">{LABELS.map(([k, label, req]) => <div key={k}><label className="label">{label}{req && ' *'}</label><select className="input" value={cols[k]} onChange={e => setCols({ ...cols, [k]: e.target.value })}><option value="">—</option>{headers.map(h => <option key={h}>{h}</option>)}</select></div>)}</div>
        : <button className="text-sm text-sharp font-medium mb-4" onClick={() => setShowMap(true)}>Kolom terdeteksi otomatis. Ubah?</button>}
      {!ok && <ErrorNote>Pilih kolom yang bertanda *.</ErrorNote>}
      {result && <>
        <div className="surface mb-4 grid grid-cols-2 sm:grid-cols-4 text-center">{[['Baris', result.totalRows, ''], ['Model', result.groups.length, ''], ['QTY 0 dilewati', result.zeroRows, ''], ['Bermasalah', result.errors.length, result.errors.length ? 'text-bad' : 'text-ok']].map(([l, v, c], i) => <div key={l as string} className={`py-3 ${i % 2 ? 'border-l border-line' : ''} ${i > 1 ? 'border-t sm:border-t-0 border-line' : ''} ${i > 0 ? 'sm:border-l' : ''}`}><p className={`text-2xl font-bold num ${c}`}>{v}</p><p className="text-xs text-mute">{l}</p></div>)}</div>
        <p className="text-sm text-ink2 mb-3">{newParts.size} part baru di master part · {plan.filter(p => p.isNewModel).length} model baru · unit part diisi PCS</p>
        {noCat > 0 && <p className="text-sm text-ink2 bg-canvas rounded-lg p-3 mb-3">{noCat} baris tanpa Supply Kategori. Part tanpa kategori tidak dicatat di aplikasi; atur kategorinya lewat menu Kategori Part.</p>}
        {result.warnings.length > 0 && <details className="bg-amber-50 rounded-lg p-3 mb-3 text-sm text-amber-900"><summary className="cursor-pointer font-medium">{result.warnings.length} baris duplikat identik digabung (dihitung sekali). Klik untuk lihat.</summary><ul className="max-h-48 overflow-auto mt-2">{result.warnings.slice(0, 100).map((w, i) => <li key={i}>Baris {w.row}: {w.msg}</li>)}</ul></details>}
        {result.errors.length > 0 && <div className="mb-3"><ErrorNote>{result.errors.length} baris bermasalah. Perbaiki di Excel lalu upload ulang.</ErrorNote><ul className="surface mt-2 p-3 text-sm text-bad max-h-60 overflow-auto">{result.errors.slice(0, 100).map((e, i) => <li key={i}>Baris {e.row}: {e.msg}</li>)}{result.errors.length > 100 && <li>…dan {result.errors.length - 100} lainnya</li>}</ul></div>}
        <div className="surface overflow-x-auto mb-4"><table className="tbl"><thead><tr><th>Model</th><th className="text-right">Part dipakai</th><th className="text-right">QTY 0</th><th>Hasil</th></tr></thead>
          <tbody>{plan.slice(0, 300).map(p => <tr key={p.g.modelId}><td className="font-medium">{p.g.model}{p.isNewModel && <span className="ml-2"><Pill tone="info">baru</Pill></span>}</td><td className="text-right num">{p.g.lines.length}</td><td className="text-right num">{p.g.skippedZero}</td><td>{p.unchanged ? <span className="text-mute">Tidak berubah (dilewati)</span> : <Pill tone="ok">Versi {p.version}</Pill>}</td></tr>)}</tbody></table></div>
        <div className="space-y-2 mb-4"><label className="flex gap-3 items-start text-sm"><input type="checkbox" className="mt-0.5 w-5 h-5 accent-[#E60012]" checked={autoActive} onChange={e => setAutoActive(e.target.checked)} />Langsung aktifkan versi baru (produksi yang sudah berjalan tidak terpengaruh)</label>
          <label className="flex gap-3 items-start text-sm"><input type="checkbox" className="mt-0.5 w-5 h-5 accent-[#E60012]" checked={confirm} onChange={e => setConfirm(e.target.checked)} />Saya konfirmasi data di atas benar. BOM lama tidak ditimpa, versi baru dibuat.</label></div>
        <button disabled={result.errors.length > 0 || !confirm || !!busy || toWrite.length === 0} className="btn btn-primary btn-lg w-full" onClick={run}>{busy || (toWrite.length === 0 ? 'Tidak ada perubahan' : `Impor ${toWrite.length} BOM`)}</button></>}</>}
    {rows.length === 0 && !msg && byModel.length === 0 && <div className="surface"><Empty title="Belum ada BOM" hint="Unggah file Excel untuk membuat BOM semua model sekaligus." /></div>}
    {msg && <p className="font-medium bg-white border border-line rounded-lg p-3 mt-4">{msg}</p>}
    {byModel.length > 0 && <section className="mt-8"><h2 className="text-sm font-semibold text-ink2 mb-2 px-1">BOM per model</h2><ul className="surface divide-y divide-line overflow-hidden">{byModel.sort((a, b) => a[0].localeCompare(b[0])).slice(0, 300).map(([id, hs]) => { const act = hs.find(h => h.active); const last = hs.reduce((m, h) => h.version > m.version ? h : m)
      return <li key={id} className="flex gap-3 items-center px-4 py-3"><span className="flex-1 font-medium">{models.items.find(m => m.id === id)?.name ?? id}</span>{act ? <Pill tone="ok">Aktif v{act.version}</Pill> : <Pill>Belum aktif</Pill>}{(!act || act.version !== last.version) && <button className="btn btn-secondary btn-sm" onClick={() => activate(id, hs, last.version)}>Aktifkan v{last.version}</button>}</li> })}</ul></section>}
  </div>
}
