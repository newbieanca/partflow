import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { CalendarDays, PackageCheck, Pencil, Plus, SlidersHorizontal } from 'lucide-react'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import { overSupplyAfterChange, todayStr, validateProduction, type SnapLine } from '../lib/production'
import { useProgress } from '../lib/useProgress'
import { partProgress, summarizeProgress } from '../lib/report'
import { Empty, ErrorNote, Pill, Progress, Sheet, StatusPill, Toast, useDialog } from '../ui'
import { LossPackSheet } from '../components/LossPack'
interface Named { name: string; active?: boolean; productCategoryId?: string }
interface Header { modelId: string; version: number; active: boolean }
type Status = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
interface Prod { modelId: string; modelName: string; productCategoryId: string; productCategoryName: string; lineId: string; lineName: string; groupId: string; groupName: string; qty: number; date: string; notes: string; status: Status; bomVersion: number; createdByName: string }
export type P = Prod & { id: string }
const RAIL: Record<Status, string> = { ACTIVE: 'bg-sharp', COMPLETED: 'bg-ok', CANCELLED: 'bg-line' }
const empty = { modelText: '', categoryId: '', lineId: '', groupId: '', qty: '', date: todayStr(), notes: '' }
export function useProductions(date: string) {
  const [items, setItems] = useState<P[]>([]); const [err, setErr] = useState('')
  useEffect(() => {
    const q = date ? query(collection(db, 'productions'), where('date', '==', date)) : query(collection(db, 'productions'), orderBy('date', 'desc'), limit(200))
    return onSnapshot(q, s => setItems(s.docs.map(d => ({ id: d.id, ...(d.data() as Prod) }))), e => setErr(e.message))
  }, [date])
  return { items, err }
}
export default function Production() {
  const { user, role } = useAuth(); const canReopen = role === 'ADMIN' || role === 'LEADER'; const isSupply = role === 'OPERATOR'; const { confirm, prompt } = useDialog(); const [sp, setSp] = useSearchParams()
  const models = useCollection<Named>('models'); const cats = useCollection<Named>('productCategories'); const lines = useCollection<Named>('productionLines')
  const groups = useCollection<Named>('operatorGroups'); const boms = useCollection<Header>('bomHeaders')
  const [filterDate, setFilterDate] = useState(todayStr()); const { items, err } = useProductions(filterDate)
  const [fCat, setFCat] = useState(''); const [fLine, setFLine] = useState(''); const [fGroup, setFGroup] = useState(''); const [fStatus, setFStatus] = useState(''); const [fModel, setFModel] = useState(''); const [showF, setShowF] = useState(false)
  const [f, setF] = useState(empty); const [editing, setEditing] = useState<P | null>(null); const [open, setOpen] = useState(false); const [msg, setMsg] = useState(''); const [formErr, setFormErr] = useState(''); const [busy, setBusy] = useState(false); const [lpProd, setLpProd] = useState<P | null>(null)
  useEffect(() => { if (sp.get('baru')) { if (!isSupply) setOpen(true); setSp({}, { replace: true }) } }, [sp, setSp, isSupply])
  const act = <T extends Named>(a: T[]) => a.filter(x => x.active !== false).sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))
  const readyModels = act(models.items).filter(m => boms.items.some(h => h.modelId === m.id && h.active))
  const model = editing ? models.items.find(m => m.id === editing.modelId) : models.items.find(m => m.name.toLowerCase() === f.modelText.trim().toLowerCase())
  const bom = model ? boms.items.find(h => h.modelId === model.id && h.active) : undefined
  const catId = editing ? editing.productCategoryId : (model?.productCategoryId || f.categoryId)
  const nm = (a: Named[] & { id: string }[], id: string) => (a as (Named & { id: string })[]).find(x => x.id === id)?.name ?? ''
  const reset = () => { setF(empty); setEditing(null); setOpen(false); setFormErr('') }
  const startEdit = (p: P) => { setEditing(p); setOpen(true); setFormErr(''); setF({ modelText: p.modelName, categoryId: p.productCategoryId, lineId: p.lineId, groupId: p.groupId, qty: String(p.qty), date: p.date, notes: p.notes ?? '' }) }

  const create = async (qty: number) => {
    const bomId = `${model!.id}_v${bom!.version}`
    // Only parts that have a supply category are tracked; the part master is the source of truth for the category.
    const [snap, tracked] = await Promise.all([getDocs(query(collection(db, 'bomDetails'), where('bomId', '==', bomId))), getDocs(query(collection(db, 'parts'), where('supplyCategoryId', '!=', '')))])
    if (snap.empty) throw new Error('BOM aktif model ini tidak berisi part')
    const cat = new Map(tracked.docs.map(d => [d.id, d.data().supplyCategoryId as string]))
    const snapLines: SnapLine[] = snap.docs.filter(d => cat.has(d.data().partId)).map(d => { const x = d.data(); return { partId: x.partId, partCode: x.partCode, partName: x.partName, qtyPerUnit: x.qtyPerUnit, unit: x.unit, supplyCategoryId: cat.get(x.partId)! } })
    if (!snapLines.length) throw new Error('Model ini tidak punya part yang dicatat (berkategori). Atur kategori part dulu di menu Kategori Part.')
    const ref = doc(collection(db, 'productions'))
    const info = { modelId: model!.id, modelName: model!.name, productCategoryId: catId, productCategoryName: nm(cats.items as never, catId), lineId: f.lineId, lineName: nm(lines.items as never, f.lineId), groupId: f.groupId, groupName: nm(groups.items as never, f.groupId), qty, date: f.date, notes: f.notes.trim(), status: 'ACTIVE' as Status, bomVersion: bom!.version, bomId }
    const b = writeBatch(db)
    b.set(ref, { ...info, createdBy: user!.uid, createdByName: user!.displayName ?? user!.email ?? '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    b.set(doc(db, 'productionBomSnapshots', ref.id), { productionId: ref.id, modelId: model!.id, bomId, bomVersion: bom!.version, lines: snapLines, createdAt: serverTimestamp() })
    await b.commit(); await audit(user!, 'CREATE', 'productions', ref.id, null, { ...info, partCount: snapLines.length }); setMsg(`Produksi ${model!.name} dibuat.`)
  }
  const saveEdit = async (qty: number): Promise<boolean> => {
    const old = editing!; let reason: string | null = null
    if (qty !== old.qty) {
      const [snap, tots] = await Promise.all([getDoc(doc(db, 'productionBomSnapshots', old.id)), getDocs(query(collection(db, 'supplyTotals'), where('productionId', '==', old.id)))])
      const taken: Record<string, number> = {}; tots.docs.forEach(d => { taken[d.data().partId] = d.data().taken })
      const over = snap.exists() ? overSupplyAfterChange(snap.data().lines as SnapLine[], qty, taken) : []
      if (over.length && !(await confirm({ title: 'Jumlah baru menyebabkan over supply', message: `${over.length} part akan kelebihan ambil, misalnya:\n${over.slice(0, 8).map(o => `${o.partCode}: ambil ${o.taken}, kebutuhan baru ${o.required}`).join('\n')}\n\nTransaksi lama tidak diubah.`, confirmLabel: 'Tetap simpan', danger: true }))) return false
      if (tots.docs.some(d => d.data().taken > 0)) { reason = await prompt({ title: 'Alasan perubahan jumlah', message: 'Sudah ada pengambilan part untuk produksi ini.', confirmLabel: 'Simpan' }); if (!reason) throw new Error('Alasan wajib diisi karena sudah ada transaksi') }
    }
    const after = { qty, lineId: f.lineId, lineName: nm(lines.items as never, f.lineId), groupId: f.groupId, groupName: nm(groups.items as never, f.groupId), date: f.date, notes: f.notes.trim() }
    await updateDoc(doc(db, 'productions', old.id), { ...after, updatedAt: serverTimestamp() })
    await audit(user!, 'UPDATE', 'productions', old.id, { qty: old.qty, lineId: old.lineId, groupId: old.groupId, date: old.date, notes: old.notes }, after, reason ?? undefined); setMsg('Perubahan disimpan.'); return true
  }
  const submit = async () => {
    setFormErr(''); const qty = Number(f.qty)
    const errs = validateProduction({ modelId: model?.id ?? '', lineId: f.lineId, groupId: f.groupId, qty, date: f.date })
    if (!catId) errs.push('Pilih kategori produk'); if (model && !editing && !bom) errs.push('Model ini belum punya BOM aktif')
    if (errs.length) return setFormErr(errs.join('. '))
    setBusy(true)
    try { const ok = editing ? await saveEdit(qty) : (await create(qty), true); if (ok) reset() } catch (e) { setFormErr((e as Error).message) } finally { setBusy(false) }
  }
  const setStatus = async (p: P, status: Status) => {
    try {
      let reason: string | undefined
      if (status === 'CANCELLED' || p.status !== 'ACTIVE') { reason = (await prompt({ title: status === 'CANCELLED' ? 'Batalkan produksi' : 'Buka kembali produksi', message: 'Tulis alasannya.', confirmLabel: status === 'CANCELLED' ? 'Batalkan' : 'Buka kembali', danger: status === 'CANCELLED' })) ?? undefined; if (!reason) return }
      if (status === 'COMPLETED' && !(await confirm({ title: 'Tandai selesai?', message: 'Setelah selesai, pengambilan part baru tidak bisa dicatat sampai dibuka kembali.', confirmLabel: 'Tandai selesai' }))) return
      await updateDoc(doc(db, 'productions', p.id), { status, updatedAt: serverTimestamp() })
      await audit(user!, 'STATUS', 'productions', p.id, { status: p.status }, { status }, reason)
    } catch (e) { setFormErr((e as Error).message); setMsg('') }
  }
  const shown = useMemo(() => items.filter(p => (!fCat || p.productCategoryId === fCat) && (!fLine || p.lineId === fLine) && (!fGroup || p.groupId === fGroup) && (!fStatus || p.status === fStatus) && (!fModel || p.modelName.toLowerCase().includes(fModel.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || a.modelName.localeCompare(b.modelName)), [items, fCat, fLine, fGroup, fStatus, fModel])
  const { lines: snaps, taken: tk } = useProgress(shown.slice(0, 40).map(p => p.id))
  const nFilters = [fCat, fLine, fGroup, fModel].filter(Boolean).length
  const field = (label: string, el: React.ReactNode, cls = '') => <div className={cls}><label className="label">{label}</label>{el}</div>
  return <div>
    <div className="flex items-center gap-2 mb-4"><div className="flex-1"><p className="text-sm text-mute"><CalendarDays size={15} className="inline -mt-0.5 mr-1" />{filterDate ? new Date(filterDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) : '200 produksi terbaru'}</p></div>
      {!isSupply && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} />Produksi baru</button>}</div>
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <input aria-label="Tanggal" type="date" className="input !w-auto" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
      {[['', 'Semua'], ['ACTIVE', 'Aktif'], ['COMPLETED', 'Selesai'], ['CANCELLED', 'Batal']].map(([v, l]) => <button key={v} className={`chip ${fStatus === v ? 'chip-on' : ''}`} onClick={() => setFStatus(v)}>{l}</button>)}
      <button className={`chip gap-1.5 ${nFilters ? 'chip-on' : ''}`} onClick={() => setShowF(!showF)}><SlidersHorizontal size={15} />Filter{nFilters > 0 && ` (${nFilters})`}</button></div>
    {showF && <div className="surface p-3 mb-3 grid gap-2 grid-cols-2 md:grid-cols-4 animate-fade">
      <input className="input" placeholder="Cari model" value={fModel} onChange={e => setFModel(e.target.value)} />
      <select className="input" value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Semua kategori</option>{act(cats.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className="input" value={fLine} onChange={e => setFLine(e.target.value)}><option value="">Semua line</option>{act(lines.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className="input" value={fGroup} onChange={e => setFGroup(e.target.value)}><option value="">Semua group</option>{act(groups.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button className="btn btn-ghost" onClick={() => setFilterDate('')}>Semua tanggal</button></div>}
    {err && <ErrorNote>{err}</ErrorNote>}{formErr && !open && <ErrorNote>{formErr}</ErrorNote>}
    {shown.length === 0 ? <div className="surface"><Empty title="Belum ada produksi" hint={isSupply ? 'Tidak ada produksi untuk filter ini. Jadwal diinput oleh Leader atau Admin.' : 'Tidak ada produksi untuk filter ini. Buat yang baru dengan tombol di atas.'} /></div> :
      <ul className="surface divide-y divide-line overflow-hidden">{shown.map(p => {
        const s = summarizeProgress(partProgress(snaps[p.id] ?? [], p.qty, tk[p.id] ?? {})); const done = s.completed + s.over; const v = s.items ? done * 100 / s.items : 0
        return <li key={p.id} className="relative pl-5 pr-4 py-4"><span className={`absolute left-0 top-0 bottom-0 w-1 ${RAIL[p.status]}`} />
          <div className="flex gap-4"><div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-[17px] leading-tight">{p.modelName}</h3>{p.status !== 'ACTIVE' && <StatusPill status={p.status} />}{s.over > 0 && <Pill tone="bad">Over {s.over}</Pill>}</div>
            <p className="text-xs text-mute mt-1">{p.productCategoryName} · {p.lineName} · {p.groupName}{!filterDate && ` · ${p.date}`}</p>
            {p.notes && <p className="text-xs text-ink2 mt-1">{p.notes}</p>}
            {s.items > 0 && <div className="mt-3 flex items-center gap-3"><div className="flex-1"><Progress value={v} tone={v === 100 ? 'ok' : 'sharp'} /></div><span className="text-xs text-mute num whitespace-nowrap">{done}/{s.items} part</span></div>}</div>
            <div className="text-right shrink-0"><p className="text-3xl font-bold tracking-tight num leading-none">{p.qty.toLocaleString('id-ID')}</p><p className="text-xs text-mute mt-1">unit</p></div></div>
          <div className="flex items-center gap-1 mt-3 -mb-1 flex-wrap">
            {p.status === 'ACTIVE' && <><Link to={`/supply?prod=${p.id}&date=${p.date}`} className="btn btn-secondary btn-sm"><PackageCheck size={15} />Supply</Link>{!isSupply && <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>Ubah</button>}<button className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'COMPLETED')}>Selesai</button>{!isSupply && <button className="btn btn-ghost btn-sm !text-bad" onClick={() => setStatus(p, 'CANCELLED')}>Batalkan</button>}</>}
            {isSupply && p.status !== 'CANCELLED' && <button className="btn btn-secondary btn-sm" onClick={() => setLpProd(p)}><Pencil size={14} />Edit</button>}
            {p.status !== 'ACTIVE' && canReopen && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'ACTIVE')}>Buka kembali</button>}
            <span className="ml-auto text-[11px] text-mute">BOM v{p.bomVersion} · {p.createdByName}</span></div></li> })}</ul>}
    <Sheet open={open} onClose={reset} title={editing ? 'Ubah produksi' : 'Produksi baru'}>
      <div className="grid gap-3 grid-cols-2">
        {field('Model', <><input list="models" disabled={!!editing} className="input" placeholder="Ketik atau pilih model" value={f.modelText} onChange={e => setF({ ...f, modelText: e.target.value })} /><datalist id="models">{readyModels.map(m => <option key={m.name} value={m.name} />)}</datalist></>, 'col-span-2')}
        {f.modelText && !model && !editing && <p className="col-span-2 text-sm text-amber-800">Model tidak ditemukan atau belum punya BOM aktif.</p>}
        {model && !editing && !bom && <p className="col-span-2 text-sm text-amber-800">Model ini belum punya BOM aktif.</p>}
        {model && (editing || model.productCategoryId) ? <p className="col-span-2 text-sm text-ink2">Kategori produk: <b>{nm(cats.items as never, catId)}</b></p>
          : model && field('Kategori produk', <select className="input" value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}><option value="">Pilih…</option>{act(cats.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>, 'col-span-2')}
        {field('Line', <select className="input" value={f.lineId} onChange={e => setF({ ...f, lineId: e.target.value })}><option value="">Pilih…</option>{act(lines.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
        {field('Group', <select className="input" value={f.groupId} onChange={e => setF({ ...f, groupId: e.target.value })}><option value="">Pilih…</option>{act(groups.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
        {field('Jumlah produksi (unit)', <input type="number" inputMode="numeric" min="1" className="input !text-lg !font-semibold num" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} />)}
        {field('Tanggal', <input type="date" className="input" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />)}
        {field('Catatan (opsional)', <input className="input" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />, 'col-span-2')}
        {formErr && <div className="col-span-2"><ErrorNote>{formErr}</ErrorNote></div>}
        <button disabled={busy} className="btn btn-primary btn-lg col-span-2" onClick={submit}>{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan produksi'}</button></div></Sheet>
    <LossPackSheet open={!!lpProd} onClose={() => setLpProd(null)} productionId={lpProd?.id ?? ''} title={lpProd ? `Edit loss pack · ${lpProd.modelName}` : ''} />
    <Toast msg={msg} onClose={() => setMsg('')} /></div>
}
