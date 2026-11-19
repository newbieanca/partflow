import { useEffect, useMemo, useState } from 'react'
import { collection, getCountFromServer, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { useProgress } from '../lib/useProgress'
import { partProgress, summarizeProgress } from '../lib/report'
import { todayStr } from '../lib/production'
import { when, type Ts } from '../lib/format'
import { useProductions } from './Production'
interface Named { name: string }
interface Tx { id: string; createdAt: Ts; modelName: string; lineName: string; groupName: string; supplyCategoryName: string; partCode: string; qty: number; unit: string; operatorName: string; shift: number; type: string }
const Card = ({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) => <div className="bg-white rounded-xl shadow p-3"><div className="text-xs text-slate-500">{label}</div><div className={`text-2xl font-bold ${tone}`}>{value}</div></div>
export default function Dashboard() {
  const cats = useCollection<Named>('productCategories'); const lns = useCollection<Named>('productionLines'); const grps = useCollection<Named>('operatorGroups'); const sc = useCollection<Named>('supplyCategories')
  const [date, setDate] = useState(todayStr()); const { items: prods } = useProductions(date)
  const [fCat, setFCat] = useState(''); const [fLine, setFLine] = useState(''); const [fGroup, setFGroup] = useState(''); const [fModel, setFModel] = useState(''); const [fSupply, setFSupply] = useState('__all'); const [fShift, setFShift] = useState('')
  const list = useMemo(() => prods.filter(p => p.status !== 'CANCELLED' && (!fCat || p.productCategoryId === fCat) && (!fLine || p.lineId === fLine) && (!fGroup || p.groupId === fGroup) && (!fModel || p.modelName.toLowerCase().includes(fModel.toLowerCase()))), [prods, fCat, fLine, fGroup, fModel])
  const { lines, taken, loading } = useProgress(list.map(p => p.id))
  const per = useMemo(() => list.map(p => { const rows = partProgress(lines[p.id] ?? [], p.qty, taken[p.id] ?? {}, fSupply); return { p, rows, s: summarizeProgress(rows) } }), [list, lines, taken, fSupply])
  const tot = per.reduce((a, x) => ({ items: a.items + x.s.items, completed: a.completed + x.s.completed, over: a.over + x.s.over, notTaken: a.notTaken + x.s.notTaken, partial: a.partial + x.s.partial, req: a.req + x.s.requiredQty, tk: a.tk + x.s.takenQty, short: a.short + x.s.shortageQty }), { items: 0, completed: 0, over: 0, notTaken: 0, partial: 0, req: 0, tk: 0, short: 0 })
  const by = (f: (p: (typeof list)[number]) => string) => { const m = new Map<string, { n: number; u: number }>(); list.forEach(p => { const e = m.get(f(p)) ?? { n: 0, u: 0 }; e.n++; e.u += p.qty; m.set(f(p), e) }); return [...m].sort((a, b) => a[0].localeCompare(b[0])) }
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => { const a = new Date(`${date}T00:00:00`), b = new Date(a); b.setDate(b.getDate() + 1); if (isNaN(a.getTime())) return; setCount(null)
    getCountFromServer(query(collection(db, 'supplyTransactions'), where('createdAt', '>=', a), where('createdAt', '<', b))).then(s => setCount(s.data().count)).catch(() => setCount(null)) }, [date])
  const [recent, setRecent] = useState<Tx[]>([])
  useEffect(() => onSnapshot(query(collection(db, 'supplyTransactions'), orderBy('createdAt', 'desc'), limit(40)), s => setRecent(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Tx, 'id'>) })))), [])
  const nm = (a: { id: string; name: string }[], id: string) => a.find(x => x.id === id)?.name
  const recentShown = recent.filter(t => (!fShift || t.shift === Number(fShift)) && (!fLine || t.lineName === nm(lns.items, fLine)) && (!fGroup || t.groupName === nm(grps.items, fGroup)) && (fSupply === '__all' || t.supplyCategoryName === (fSupply ? nm(sc.items, fSupply) : '')) && (!fModel || t.modelName.toLowerCase().includes(fModel.toLowerCase()))).slice(0, 15)
  const alerts = per.flatMap(x => x.rows.filter(r => r.status === 'OVER_SUPPLY').map(r => ({ p: x.p, r })))
  const sel = 'border rounded-lg p-2 bg-white'
  return <div className="space-y-4"><h2 className="text-lg font-bold">Dashboard</h2>
    <div className="bg-white rounded-xl shadow p-3 grid gap-2 grid-cols-2 sm:grid-cols-4">
      <label className="text-xs col-span-2 sm:col-span-1">Tanggal<input type="date" className={sel + ' w-full'} value={date} onChange={e => setDate(e.target.value)} /></label>
      <select className={sel} value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Semua kategori</option>{cats.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input className={sel} placeholder="Cari model" value={fModel} onChange={e => setFModel(e.target.value)} />
      <select className={sel} value={fLine} onChange={e => setFLine(e.target.value)}><option value="">Semua line</option>{lns.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className={sel} value={fGroup} onChange={e => setFGroup(e.target.value)}><option value="">Semua group</option>{grps.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className={sel} value={fShift} onChange={e => setFShift(e.target.value)}><option value="">Semua shift (aktivitas)</option><option>1</option><option>2</option><option>3</option></select>
      <select className={sel + ' col-span-2'} value={fSupply} onChange={e => setFSupply(e.target.value)}><option value="__all">Semua supply category</option>{sc.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="">Belum diatur</option></select></div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Card label="Produksi berjalan" value={list.length} /><Card label="Total unit" value={list.reduce((a, p) => a + p.qty, 0)} />
      <Card label="Transaksi hari itu" value={count ?? '…'} /><Card label="Over supply" value={tot.over} tone={tot.over ? 'text-red-600' : ''} />
      <Card label="Part selesai" value={`${tot.completed}/${tot.items}`} tone="text-green-700" /><Card label="Part sebagian" value={tot.partial} tone="text-orange-600" /><Card label="Part belum diambil" value={tot.notTaken} />
      <Card label="Total qty kurang" value={tot.short} tone={tot.short ? 'text-orange-600' : ''} /></div>
    <p className="text-xs text-slate-500">Butuh {tot.req} · diambil {tot.tk} · kurang {tot.short} (jumlah qty semua part, satuan campur){loading && ' · memuat…'}</p>
    <div className="grid sm:grid-cols-2 gap-2">{[['Per line', by(p => p.lineName)], ['Per group', by(p => p.groupName)]].map(([t, rows]) => <div key={t as string} className="bg-white rounded-xl shadow p-3"><b className="text-sm">{t as string}</b>{(rows as [string, { n: number; u: number }][]).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><span>{v.n} produksi · {v.u} unit</span></div>)}{!(rows as unknown[]).length && <p className="text-sm text-slate-500">-</p>}</div>)}</div>
    {alerts.length > 0 && <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm space-y-1"><b className="text-red-700">⚠ Over supply ({alerts.length})</b>{alerts.slice(0, 20).map(({ p, r }) => <p key={p.id + r.partId}>{p.modelName} ({p.lineName}/{p.groupName}) · {r.partCode} · butuh {r.required}, diambil {r.taken} (lebih {-r.remaining})</p>)}</div>}
    <div className="space-y-2"><h3 className="font-bold">Progres per produksi</h3>{per.length === 0 && <p className="text-slate-500">Tidak ada produksi untuk filter ini.</p>}
      {per.map(({ p, s }) => <div key={p.id} className="bg-white rounded-xl shadow p-3 text-sm space-y-1"><div className="flex gap-2"><b className="flex-1">{p.modelName}</b><span className="text-xs">{p.status}</span></div>
        <p className="text-slate-600">{p.lineName} · {p.groupName} · {p.qty} unit</p>
        <div className="h-2 bg-slate-200 rounded"><div className="h-2 bg-green-500 rounded" style={{ width: `${s.items ? Math.round(s.completed * 100 / s.items) : 0}%` }} /></div>
        <p>Selesai {s.completed}/{s.items} · sebagian {s.partial} · belum {s.notTaken}{s.over > 0 && <b className="text-red-600"> · over {s.over}</b>}</p></div>)}</div>
    <div className="space-y-2"><h3 className="font-bold">Aktivitas terbaru</h3>{recentShown.length === 0 && <p className="text-slate-500">Belum ada aktivitas.</p>}
      {recentShown.map(t => <div key={t.id} className="bg-white rounded-xl shadow p-3 text-sm"><div className="flex gap-2"><b className="flex-1">{t.partCode}</b><b className={t.type === 'OVER_SUPPLY' ? 'text-red-600' : ''}>{t.qty} {t.unit}</b></div><p className="text-slate-500">{t.modelName} · {t.operatorName} · Shift {t.shift} · {when(t.createdAt)}</p></div>)}</div></div>
}
