import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { useAuth } from '../auth/AuthContext'
import { remainingQty, requiredQty, sumQty, supplyStatus, takeAllQty } from '../lib/bom'
import { OverSupplyError, recordTake, reverseTransaction, type OverInfo } from '../lib/supply'
import { todayStr, type SnapLine } from '../lib/production'
import { when, type Ts } from '../lib/format'
import { useProductions } from './Production'
interface Tx { id: string; partId: string; qty: number; shift: number; type: string; operatorName: string; createdAt: Ts }
interface Adj { id: string; txId: string }
const BADGE: Record<string, [string, string]> = { NOT_TAKEN: ['Belum diambil', 'bg-slate-200 text-slate-700'], PARTIAL: ['Sebagian', 'bg-orange-100 text-orange-800'], COMPLETED: ['Selesai', 'bg-green-100 text-green-800'], OVER_SUPPLY: ['OVER SUPPLY', 'bg-red-100 text-red-700'] }
const ms = (t: Ts) => t?.toDate ? t.toDate().getTime() : Infinity
function useLive<T>(coll: string, productionId: string) {
  const [items, setItems] = useState<(T & { id: string })[]>([])
  useEffect(() => { setItems([]); if (!productionId) return; return onSnapshot(query(collection(db, coll), where('productionId', '==', productionId)), s => setItems(s.docs.map(d => ({ id: d.id, ...(d.data() as T) })))) }, [coll, productionId])
  return items
}
export default function Supply() {
  const { user, role } = useAuth(); const leaderUp = role === 'ADMIN' || role === 'LEADER'; const uname = user?.displayName ?? user?.email ?? ''
  const cats = useCollection<{ name: string }>('supplyCategories')
  const [date, setDate] = useState(todayStr()); const { items: prods } = useProductions(date)
  const [prodId, setProdId] = useState(''); const prod = prods.find(p => p.id === prodId)
  const [shift, setShiftS] = useState(() => { try { return Number(localStorage.getItem('partflow.shift')) || 0 } catch { return 0 } })
  const setShift = (n: number) => { setShiftS(n); try { localStorage.setItem('partflow.shift', String(n)) } catch { /* ignore */ } }
  const [catF, setCatF] = useState('__all'); const [q, setQ] = useState(''); const [pending, setPending] = useState(false)
  const [lines, setLines] = useState<SnapLine[]>([])
  useEffect(() => { setLines([]); if (!prodId) return; return onSnapshot(doc(db, 'productionBomSnapshots', prodId), s => setLines(s.exists() ? (s.data().lines as SnapLine[]) : [])) }, [prodId])
  const txs = useLive<Tx>('supplyTransactions', prodId); const adjs = useLive<Adj>('transactionAdjustments', prodId)
  const reversed = useMemo(() => new Set(adjs.map(a => a.txId)), [adjs])
  const rows = useMemo(() => {
    if (!prod) return []
    const by = new Map<string, { taken: number; shifts: Record<number, number>; list: Tx[] }>()
    txs.forEach(t => { const e = by.get(t.partId) ?? { taken: 0, shifts: {}, list: [] }; e.list.push(t); if (!reversed.has(t.id)) { e.taken = sumQty(e.taken, t.qty); e.shifts[t.shift] = sumQty(e.shifts[t.shift] ?? 0, t.qty) } by.set(t.partId, e) })
    return lines.map(l => { const required = requiredQty(l.qtyPerUnit, prod.qty); const e = by.get(l.partId) ?? { taken: 0, shifts: {}, list: [] as Tx[] }
      return { ...l, required, taken: e.taken, remaining: remainingQty(required, e.taken), status: supplyStatus(required, e.taken), shifts: e.shifts, list: [...e.list].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)) } }).sort((a, b) => a.partCode.localeCompare(b.partCode))
  }, [prod, lines, txs, reversed])
  const catName = (id: string) => cats.items.find(c => c.id === id)?.name ?? ''
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = rows.filter(r => (catF === '__all' || r.supplyCategoryId === catF) && (!pending || r.status !== 'COMPLETED') && tokens.every(t => `${r.partCode} ${r.partName}`.toLowerCase().includes(t)))
  const count = (s: string) => rows.filter(r => r.status === s).length
  const [take, setTake] = useState<{ partId: string; value: string; over?: OverInfo } | null>(null)
  const [openPart, setOpenPart] = useState(''); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const keys = useRef<Record<string, string>>({})
  const go = async (r: (typeof rows)[number], mode: 'TAKE_ALL' | 'PARTIAL', qty: number, confirmOver: boolean) => {
    if (!shift) return setMsg('Pilih shift aktif Anda dulu.')
    setBusy(r.partId); setMsg(''); const key = (keys.current[r.partId] ??= crypto.randomUUID()) // same key on retry = no duplicate
    try {
      const res = await recordTake(db, { idempotencyKey: key, productionId: prodId, partId: r.partId, mode, qty, shift, confirmOver, notes: '', supplyCategoryName: catName(r.supplyCategoryId), user: { uid: user!.uid, name: uname } })
      delete keys.current[r.partId]; setTake(null)
      setMsg(res.duplicate ? 'Transaksi ini sudah tercatat sebelumnya (tidak dobel).' : `Tercatat: ${r.partCode} ${res.qty} ${r.unit} (Shift ${shift})`)
    } catch (e) {
      if (e instanceof OverSupplyError) setTake({ partId: r.partId, value: String(qty), over: e.info })
      else setMsg((e as Error).message.includes('offline') || (e as Error).message.includes('unavailable') ? 'Tidak ada koneksi. Coba lagi saat online; tidak ada data yang tersimpan.' : (e as Error).message)
    } finally { setBusy('') }
  }
  const correct = async (txId: string) => { const reason = prompt('Alasan koreksi (transaksi dibatalkan, data asli tetap tersimpan):')?.trim(); if (!reason) return; try { await reverseTransaction(db, { txId, reason, user: { uid: user!.uid, name: uname } }); setMsg('Koreksi tercatat.') } catch (e) { setMsg((e as Error).message) } }
  const sel = 'border rounded-lg p-2 bg-white'; const active = prod?.status === 'ACTIVE'
  return <div className="space-y-4"><h2 className="text-lg font-bold">Supply Part</h2>
    <div className="bg-white rounded-xl shadow p-3 space-y-2"><p className="text-sm font-semibold">Shift aktif Anda</p>
      <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map(n => <button key={n} onClick={() => setShift(n)} className={`rounded-lg p-3 font-semibold ${shift === n ? 'bg-[#0b1f3a] text-white' : 'bg-slate-100'}`}>Shift {n}</button>)}</div>
      {!shift && <p className="text-sm text-orange-600">Pilih shift sebelum mencatat pengambilan part.</p>}</div>
    <div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Tanggal produksi<input type="date" className={sel + ' w-full'} value={date} onChange={e => { setDate(e.target.value); setProdId('') }} /></label>
      <label className="text-sm">Produksi<select className={sel + ' w-full'} value={prodId} onChange={e => { setProdId(e.target.value); setTake(null) }}><option value="">Pilih produksi…</option>{prods.filter(p => p.status !== 'CANCELLED').map(p => <option key={p.id} value={p.id}>{p.modelName} · {p.lineName} · {p.groupName} · {p.qty} unit{p.status === 'COMPLETED' ? ' (selesai)' : ''}</option>)}</select></label></div>
    {msg && <p className="font-medium bg-white rounded-lg p-3 shadow">{msg}</p>}
    {prod && <>
      <div className="bg-white rounded-xl shadow p-3 text-sm"><b>{prod.modelName}</b> · {prod.qty} unit · {prod.lineName} · {prod.groupName} · BOM v{prod.bomVersion}
        {!active && <p className="text-orange-600 font-medium">Produksi {prod.status}. Pengambilan part dikunci; minta Leader/Admin membuka kembali.</p>}
        <p className="pt-1">Belum {count('NOT_TAKEN')} · Sebagian {count('PARTIAL')} · Selesai {count('COMPLETED')} · <span className={count('OVER_SUPPLY') ? 'text-red-600 font-bold' : ''}>Over {count('OVER_SUPPLY')}</span></p></div>
      <div className="grid gap-2 grid-cols-2"><select className={sel} value={catF} onChange={e => setCatF(e.target.value)}><option value="__all">Semua supply category</option>{cats.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="">Belum diatur</option></select>
        <input className={sel} placeholder="Cari kode / nama part" value={q} onChange={e => setQ(e.target.value)} />
        <label className="text-sm col-span-2 flex gap-2 items-center"><input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} /> Sembunyikan part yang sudah selesai</label></div>
      <p className="text-sm text-slate-500">{shown.length} dari {rows.length} part</p>
      <ul className="space-y-2">{shown.slice(0, 150).map(r => { const [lbl, cls] = BADGE[r.status]; const tk = take?.partId === r.partId ? take : null
        return <li key={r.partId} className="bg-white rounded-xl shadow p-3 space-y-2">
          <div className="flex items-start gap-2"><div className="flex-1"><b>{r.partCode}</b><div className="text-sm">{r.partName}</div><div className="text-xs text-slate-500">{catName(r.supplyCategoryId) || 'Supply category belum diatur'}</div></div><span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${cls}`}>{lbl}</span></div>
          <div className="grid grid-cols-4 gap-1 text-center text-sm"><div><div className="text-xs text-slate-500">BOM</div>{r.qtyPerUnit}</div><div><div className="text-xs text-slate-500">Butuh</div><b>{r.required}</b></div><div><div className="text-xs text-slate-500">Diambil</div>{r.taken}</div><div><div className="text-xs text-slate-500">Sisa</div><b className={r.remaining < 0 ? 'text-red-600' : ''}>{r.remaining}</b></div></div>
          <p className="text-xs text-slate-600">{[1, 2, 3].map(n => `S${n}: ${r.shifts[n] ?? 0}`).join(' · ')}</p>
          {active && <div className="flex gap-2">
            <button disabled={!!busy || !takeAllQty(r.required, r.taken)} className="flex-1 bg-blue-600 disabled:opacity-40 text-white rounded-lg p-3 font-semibold" onClick={() => { if (confirm(`Ambil semua sisa ${takeAllQty(r.required, r.taken)} ${r.unit} untuk ${r.partCode} (Shift ${shift || '?'})?`)) go(r, 'TAKE_ALL', 0, false) }}>Ambil Semua ({takeAllQty(r.required, r.taken)})</button>
            <button disabled={!!busy} className="flex-1 border border-blue-600 text-blue-700 rounded-lg p-3 font-semibold" onClick={() => { delete keys.current[r.partId]; setTake(tk ? null : { partId: r.partId, value: '' }) }}>Ambil Sebagian</button></div>}
          {tk && !tk.over && <div className="flex gap-2"><input autoFocus type="number" inputMode="decimal" min="0" step="any" placeholder={`Jumlah (${r.unit})`} className="flex-1 border rounded-lg p-3" value={tk.value} onChange={e => { delete keys.current[r.partId]; setTake({ partId: r.partId, value: e.target.value }) }} /><button disabled={!!busy} className="bg-blue-600 disabled:opacity-40 text-white rounded-lg px-5 font-semibold" onClick={() => go(r, 'PARTIAL', Number(tk.value), false)}>Catat</button></div>}
          {tk?.over && <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-1 text-sm"><p className="font-bold text-red-700">⚠ Melebihi kebutuhan (OVER SUPPLY)</p>
            <p>Kebutuhan {tk.over.required} · sudah diambil {tk.over.taken} · sisa {Math.max(0, tk.over.remaining)} · kelebihan <b>{tk.over.excess}</b></p>
            <div className="flex gap-2 pt-1"><button disabled={!!busy} className="flex-1 bg-red-600 text-white rounded-lg p-3 font-semibold" onClick={() => go(r, 'PARTIAL', Number(tk.value), true)}>Ya, catat OVER SUPPLY</button><button className="flex-1 border rounded-lg p-3" onClick={() => setTake(null)}>Batal</button></div></div>}
          <button className="text-sm underline" onClick={() => setOpenPart(openPart === r.partId ? '' : r.partId)}>Riwayat ({r.list.length})</button>
          {openPart === r.partId && <ul className="text-sm divide-y">{r.list.length === 0 && <li className="py-1 text-slate-500">Belum ada pengambilan.</li>}{r.list.map(t => <li key={t.id} className="py-1 flex gap-2 items-center flex-wrap"><span className={reversed.has(t.id) ? 'line-through text-slate-400 flex-1' : 'flex-1'}>{when(t.createdAt)} · {t.operatorName} · Shift {t.shift} · <b>{t.qty}</b>{t.type === 'OVER_SUPPLY' && <span className="text-red-600"> · OVER</span>}</span>{reversed.has(t.id) ? <em className="text-xs text-slate-500">dikoreksi</em> : leaderUp && <button className="underline text-xs" onClick={() => correct(t.id)}>Koreksi</button>}</li>)}</ul>}
        </li> })}</ul>
      {shown.length > 150 && <p className="text-sm text-slate-500">Menampilkan 150 pertama. Persempit dengan pencarian atau supply category.</p>}</>}
  </div>
}
