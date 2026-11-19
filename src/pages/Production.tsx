import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import { overSupplyAfterChange, todayStr, validateProduction, type SnapLine } from '../lib/production'
interface Named { name: string; active?: boolean; productCategoryId?: string }
interface Header { modelId: string; version: number; active: boolean }
type Status = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
interface Prod { modelId: string; modelName: string; productCategoryId: string; productCategoryName: string; lineId: string; lineName: string; groupId: string; groupName: string; qty: number; date: string; notes: string; status: Status; bomVersion: number; createdByName: string }
type P = Prod & { id: string }
const BADGE: Record<Status, string> = { ACTIVE: 'bg-blue-100 text-blue-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-slate-200 text-slate-600' }
const empty = { modelText: '', categoryId: '', lineId: '', groupId: '', qty: '', date: todayStr(), notes: '' }
function useProductions(date: string) {
  const [items, setItems] = useState<P[]>([]); const [err, setErr] = useState('')
  useEffect(() => {
    const q = date ? query(collection(db, 'productions'), where('date', '==', date)) : query(collection(db, 'productions'), orderBy('date', 'desc'), limit(200))
    return onSnapshot(q, s => setItems(s.docs.map(d => ({ id: d.id, ...(d.data() as Prod) }))), e => setErr(e.message))
  }, [date])
  return { items, err }
}
export default function Production() {
  const { user, role } = useAuth(); const canReopen = role === 'ADMIN' || role === 'LEADER'
  const models = useCollection<Named>('models'); const cats = useCollection<Named>('productCategories'); const lines = useCollection<Named>('productionLines')
  const groups = useCollection<Named>('operatorGroups'); const boms = useCollection<Header>('bomHeaders')
  const [filterDate, setFilterDate] = useState(todayStr()); const { items, err } = useProductions(filterDate)
  const [fCat, setFCat] = useState(''); const [fLine, setFLine] = useState(''); const [fGroup, setFGroup] = useState(''); const [fStatus, setFStatus] = useState(''); const [fModel, setFModel] = useState('')
  const [f, setF] = useState(empty); const [editing, setEditing] = useState<P | null>(null); const [open, setOpen] = useState(false); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const act = <T extends Named>(a: T[]) => a.filter(x => x.active !== false).sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))
  const readyModels = act(models.items).filter(m => boms.items.some(h => h.modelId === m.id && h.active))
  const model = editing ? models.items.find(m => m.id === editing.modelId) : models.items.find(m => m.name.toLowerCase() === f.modelText.trim().toLowerCase())
  const bom = model ? boms.items.find(h => h.modelId === model.id && h.active) : undefined
  const catId = editing ? editing.productCategoryId : (model?.productCategoryId || f.categoryId)
  const nm = (a: Named[] & { id: string }[], id: string) => (a as (Named & { id: string })[]).find(x => x.id === id)?.name ?? ''
  const reset = () => { setF(empty); setEditing(null); setOpen(false); setMsg('') }
  const startEdit = (p: P) => { setEditing(p); setOpen(true); setMsg(''); setF({ modelText: p.modelName, categoryId: p.productCategoryId, lineId: p.lineId, groupId: p.groupId, qty: String(p.qty), date: p.date, notes: p.notes ?? '' }) }

  const create = async (qty: number) => {
    const bomId = `${model!.id}_v${bom!.version}`
    const snap = await getDocs(query(collection(db, 'bomDetails'), where('bomId', '==', bomId)))
    if (snap.empty) throw new Error('BOM aktif model ini tidak berisi part')
    const snapLines: SnapLine[] = snap.docs.map(d => { const x = d.data(); return { partId: x.partId, partCode: x.partCode, partName: x.partName, qtyPerUnit: x.qtyPerUnit, unit: x.unit, supplyCategoryId: x.supplyCategoryId ?? '' } })
    const ref = doc(collection(db, 'productions'))
    const info = { modelId: model!.id, modelName: model!.name, productCategoryId: catId, productCategoryName: nm(cats.items as never, catId), lineId: f.lineId, lineName: nm(lines.items as never, f.lineId), groupId: f.groupId, groupName: nm(groups.items as never, f.groupId), qty, date: f.date, notes: f.notes.trim(), status: 'ACTIVE' as Status, bomVersion: bom!.version, bomId }
    const b = writeBatch(db)
    b.set(ref, { ...info, createdBy: user!.uid, createdByName: user!.displayName ?? user!.email ?? '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    b.set(doc(db, 'productionBomSnapshots', ref.id), { productionId: ref.id, modelId: model!.id, bomId, bomVersion: bom!.version, lines: snapLines, createdAt: serverTimestamp() })
    await b.commit(); await audit(user!, 'CREATE', 'productions', ref.id, null, { ...info, partCount: snapLines.length })
  }
  const saveEdit = async (qty: number) => {
    const old = editing!; let reason: string | null = null
    if (qty !== old.qty) {
      const [snap, tots] = await Promise.all([getDoc(doc(db, 'productionBomSnapshots', old.id)), getDocs(query(collection(db, 'supplyTotals'), where('productionId', '==', old.id)))])
      const taken: Record<string, number> = {}; tots.docs.forEach(d => { taken[d.data().partId] = d.data().taken })
      const over = snap.exists() ? overSupplyAfterChange(snap.data().lines as SnapLine[], qty, taken) : []
      if (over.length && !confirm(`Jumlah baru membuat ${over.length} part kelebihan ambil (over-supply), misalnya:\n${over.slice(0, 8).map(o => `${o.partCode}: ambil ${o.taken}, kebutuhan baru ${o.required}`).join('\n')}\n\nTetap simpan? Transaksi lama tidak diubah.`)) return
      if (tots.docs.some(d => d.data().taken > 0)) { reason = prompt('Sudah ada pengambilan part untuk produksi ini. Tulis alasan perubahan jumlah:')?.trim() || ''; if (!reason) throw new Error('Alasan wajib diisi karena sudah ada transaksi') }
    }
    const after = { qty, lineId: f.lineId, lineName: nm(lines.items as never, f.lineId), groupId: f.groupId, groupName: nm(groups.items as never, f.groupId), date: f.date, notes: f.notes.trim() }
    await updateDoc(doc(db, 'productions', old.id), { ...after, updatedAt: serverTimestamp() })
    await audit(user!, 'UPDATE', 'productions', old.id, { qty: old.qty, lineId: old.lineId, groupId: old.groupId, date: old.date, notes: old.notes }, after, reason ?? undefined)
  }
  const submit = async () => {
    setMsg(''); const qty = Number(f.qty)
    const errs = validateProduction({ modelId: model?.id ?? '', lineId: f.lineId, groupId: f.groupId, qty, date: f.date })
    if (!catId) errs.push('Pilih kategori produk'); if (model && !editing && !bom) errs.push('Model ini belum punya BOM aktif')
    if (errs.length) return setMsg(errs.join('. '))
    setBusy(true)
    try { if (editing) { await saveEdit(qty) } else { await create(qty) }; reset() } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const setStatus = async (p: P, status: Status) => {
    try {
      let reason: string | undefined
      if (status === 'CANCELLED' || p.status !== 'ACTIVE') { reason = prompt(status === 'CANCELLED' ? 'Alasan pembatalan:' : 'Alasan membuka kembali:')?.trim(); if (!reason) return alert('Alasan wajib diisi') }
      if (status === 'COMPLETED' && !confirm('Tandai selesai? Setelah selesai, pengambilan part baru tidak bisa dicatat sampai dibuka kembali.')) return
      await updateDoc(doc(db, 'productions', p.id), { status, updatedAt: serverTimestamp() })
      await audit(user!, 'STATUS', 'productions', p.id, { status: p.status }, { status }, reason)
    } catch (e) { setMsg((e as Error).message) }
  }
  const shown = useMemo(() => items.filter(p => (!fCat || p.productCategoryId === fCat) && (!fLine || p.lineId === fLine) && (!fGroup || p.groupId === fGroup) && (!fStatus || p.status === fStatus) && (!fModel || p.modelName.toLowerCase().includes(fModel.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || a.modelName.localeCompare(b.modelName)), [items, fCat, fLine, fGroup, fStatus, fModel])
  const sel = 'border rounded-lg p-2 bg-white'
  return <div className="space-y-4"><h2 className="text-lg font-bold">Produksi</h2>
    {!open && <button className="w-full bg-blue-600 text-white rounded-lg p-4 font-semibold text-lg" onClick={() => setOpen(true)}>+ Buat Produksi Baru</button>}
    {open && <div className="bg-white rounded-xl shadow p-4 grid gap-3 sm:grid-cols-2">
      <h3 className="font-bold sm:col-span-2">{editing ? 'Ubah Produksi' : 'Produksi Baru'}</h3>
      <label className="text-sm sm:col-span-2">Model<input list="models" disabled={!!editing} className="w-full border rounded-lg p-3 disabled:bg-slate-100" placeholder="Ketik atau pilih model" value={f.modelText} onChange={e => setF({ ...f, modelText: e.target.value })} /><datalist id="models">{readyModels.map(m => <option key={m.name} value={m.name} />)}</datalist></label>
      {f.modelText && !model && !editing && <p className="text-sm text-orange-600 sm:col-span-2">Model tidak ditemukan atau belum punya BOM aktif.</p>}
      {model && !editing && !bom && <p className="text-sm text-orange-600 sm:col-span-2">Model ini belum punya BOM aktif.</p>}
      {model && (editing || model.productCategoryId) ? <p className="text-sm sm:col-span-2">Kategori produk: <b>{nm(cats.items as never, catId)}</b></p>
        : model && <label className="text-sm sm:col-span-2">Kategori produk<select className={sel + ' w-full'} value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}><option value="">Pilih kategori…</option>{act(cats.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label className="text-sm">Line<select className={sel + ' w-full'} value={f.lineId} onChange={e => setF({ ...f, lineId: e.target.value })}><option value="">Pilih…</option>{act(lines.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm">Group<select className={sel + ' w-full'} value={f.groupId} onChange={e => setF({ ...f, groupId: e.target.value })}><option value="">Pilih…</option>{act(groups.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm">Jumlah produksi (unit)<input type="number" inputMode="numeric" min="1" className="w-full border rounded-lg p-3" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} /></label>
      <label className="text-sm">Tanggal produksi<input type="date" className="w-full border rounded-lg p-3" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
      <label className="text-sm sm:col-span-2">Catatan (opsional)<input className="w-full border rounded-lg p-3" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
      {msg && <p className="text-red-600 sm:col-span-2">{msg}</p>}
      <button disabled={busy} className="bg-blue-600 disabled:opacity-40 text-white rounded-lg p-3 font-semibold" onClick={submit}>{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan produksi'}</button>
      <button className="border rounded-lg p-3" onClick={reset}>Batal</button></div>}
    {!open && msg && <p className="text-red-600">{msg}</p>}
    <div className="bg-white rounded-xl shadow p-3 grid gap-2 grid-cols-2 sm:grid-cols-3">
      <label className="text-xs col-span-2 sm:col-span-1">Tanggal<input type="date" className={sel + ' w-full'} value={filterDate} onChange={e => setFilterDate(e.target.value)} /></label>
      <button className="text-xs underline text-left self-end pb-2" onClick={() => setFilterDate('')}>Semua tanggal (200 terbaru)</button>
      <input className={sel} placeholder="Cari model" value={fModel} onChange={e => setFModel(e.target.value)} />
      <select className={sel} value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Semua kategori</option>{act(cats.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className={sel} value={fLine} onChange={e => setFLine(e.target.value)}><option value="">Semua line</option>{act(lines.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className={sel} value={fGroup} onChange={e => setFGroup(e.target.value)}><option value="">Semua group</option>{act(groups.items).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className={sel} value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="">Semua status</option><option>ACTIVE</option><option>COMPLETED</option><option>CANCELLED</option></select></div>
    {err && <p className="text-red-600">{err}</p>}
    {shown.length === 0 && <p className="text-slate-500">Belum ada produksi untuk filter ini.</p>}
    <ul className="space-y-2">{shown.map(p => <li key={p.id} className="bg-white rounded-xl shadow p-3 space-y-1">
      <div className="flex items-center gap-2"><b className="flex-1">{p.modelName}</b><span className={`text-xs px-2 py-1 rounded-full ${BADGE[p.status]}`}>{p.status}</span></div>
      <p className="text-sm text-slate-600">{p.date} · {p.lineName} · {p.groupName} · {p.productCategoryName}</p>
      <p className="text-sm"><b>{p.qty}</b> unit · BOM v{p.bomVersion} · oleh {p.createdByName}{p.notes && ` · ${p.notes}`}</p>
      <div className="flex gap-4 text-sm pt-1">{p.status === 'ACTIVE' && <><button className="underline" onClick={() => startEdit(p)}>Ubah</button><button className="underline" onClick={() => setStatus(p, 'COMPLETED')}>Selesai</button><button className="underline text-red-600" onClick={() => setStatus(p, 'CANCELLED')}>Batalkan</button></>}
        {p.status !== 'ACTIVE' && canReopen && <button className="underline" onClick={() => setStatus(p, 'ACTIVE')}>Buka kembali</button>}</div></li>)}</ul></div>
}
