import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getCountFromServer, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { AlertTriangle, ChevronRight, PackageCheck, Plus, SlidersHorizontal } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../auth/AuthContext'
import { useCollection } from '../lib/useCollection'
import { useProgress } from '../lib/useProgress'
import { partProgress, summarizeProgress } from '../lib/report'
import { todayStr } from '../lib/production'
import { useShift } from '../lib/shift'
import { when, type Ts } from '../lib/format'
import { Empty, Pill, Progress, Section } from '../ui'
import { useProductions } from './Production'
import SupplyHome from './SupplyHome'
interface Named { name: string }
interface Tx { id: string; createdAt: Ts; modelName: string; lineName: string; groupName: string; supplyCategoryName: string; partCode: string; qty: number; unit: string; operatorName: string; shift: number; type: string }
const greeting = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam' }
const Dist = ({ rows }: { rows: [string, { n: number; u: number }][] }) => { const max = Math.max(1, ...rows.map(([, v]) => v.u)); return rows.length === 0 ? <p className="text-sm text-mute px-1">-</p> : <div className="surface p-4 space-y-4">{rows.map(([k, v]) => <div key={k}><div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">{k}</span><span className="text-mute num">{v.n} produksi · {v.u.toLocaleString('id-ID')} unit</span></div><Progress value={v.u * 100 / max} tone="ink" /></div>)}</div> }
const Kpi = ({ label, value, sub, tone = '', edge = '' }: { label: string; value: string | number; sub?: string; tone?: string; edge?: string }) =>
  <div className={`px-4 py-4 md:px-6 ${edge}`}><p className="text-xs text-mute">{label}</p><p className={`text-3xl md:text-4xl font-bold tracking-tight num mt-1 ${tone}`}>{value}</p>{sub && <p className="text-xs text-mute mt-1">{sub}</p>}</div>
function LeaderDashboard() {
  const { user } = useAuth(); const shift = useShift()
  const cats = useCollection<Named>('productCategories'); const lns = useCollection<Named>('productionLines'); const grps = useCollection<Named>('operatorGroups'); const sc = useCollection<Named>('supplyCategories')
  const [date, setDate] = useState(todayStr()); const { items: prods } = useProductions(date)
  const [fCat, setFCat] = useState(''); const [fLine, setFLine] = useState(''); const [fGroup, setFGroup] = useState(''); const [fModel, setFModel] = useState(''); const [fSupply, setFSupply] = useState('__all'); const [fShift, setFShift] = useState(''); const [showF, setShowF] = useState(false)
  const nFilters = [fCat, fLine, fGroup, fModel, fShift].filter(Boolean).length + (fSupply !== '__all' ? 1 : 0)
  const list = useMemo(() => prods.filter(p => p.status !== 'CANCELLED' && (!fCat || p.productCategoryId === fCat) && (!fLine || p.lineId === fLine) && (!fGroup || p.groupId === fGroup) && (!fModel || p.modelName.toLowerCase().includes(fModel.toLowerCase()))), [prods, fCat, fLine, fGroup, fModel])
  const { lines, taken, loading } = useProgress(list.map(p => p.id))
  const per = useMemo(() => list.map(p => { const rows = partProgress(lines[p.id] ?? [], p.qty, taken[p.id] ?? {}, fSupply); return { p, rows, s: summarizeProgress(rows) } }), [list, lines, taken, fSupply])
  const tot = per.reduce((a, x) => ({ items: a.items + x.s.items, done: a.done + x.s.completed + x.s.over, over: a.over + x.s.over, short: a.short + x.s.shortageQty }), { items: 0, done: 0, over: 0, short: 0 })
  const pct = tot.items ? Math.round(tot.done * 100 / tot.items) : 0
  const dist = (key: (p: (typeof list)[number]) => string) => { const m = new Map<string, { n: number; u: number }>(); list.forEach(p => { const e = m.get(key(p)) ?? { n: 0, u: 0 }; e.n++; e.u += p.qty; m.set(key(p), e) }); return [...m].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })) }
  const byLine = useMemo(() => dist(p => p.lineName), [list]); const byGroup = useMemo(() => dist(p => p.groupName), [list])
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => { const a = new Date(`${date}T00:00:00`), b = new Date(a); b.setDate(b.getDate() + 1); if (isNaN(a.getTime())) return; setCount(null)
    getCountFromServer(query(collection(db, 'supplyTransactions'), where('createdAt', '>=', a), where('createdAt', '<', b))).then(s => setCount(s.data().count)).catch(() => setCount(null)) }, [date])
  const [recent, setRecent] = useState<Tx[]>([])
  useEffect(() => onSnapshot(query(collection(db, 'supplyTransactions'), orderBy('createdAt', 'desc'), limit(40)), s => setRecent(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Tx, 'id'>) })))), [])
  const nm = (a: { id: string; name: string }[], id: string) => a.find(x => x.id === id)?.name
  const recentShown = recent.filter(t => (!fShift || t.shift === Number(fShift)) && (!fLine || t.lineName === nm(lns.items, fLine)) && (!fGroup || t.groupName === nm(grps.items, fGroup)) && (fSupply === '__all' || t.supplyCategoryName === nm(sc.items, fSupply)) && (!fModel || t.modelName.toLowerCase().includes(fModel.toLowerCase()))).slice(0, 8)
  const alerts = per.flatMap(x => x.rows.filter(r => r.status === 'OVER_SUPPLY').map(r => ({ p: x.p, r })))
  const lagging = [...per].filter(x => x.s.items - x.s.completed - x.s.over > 0).sort((a, b) => (b.s.items - b.s.completed - b.s.over) - (a.s.items - a.s.completed - a.s.over)).slice(0, 4)
  const first = (user?.displayName ?? user?.email ?? '').split(/[\s@]/)[0]
  return <div>
    <div className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex-1 min-w-[14rem]"><p className="text-sm text-mute">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{greeting()}, {first}</h2>
        <p className="text-sm text-mute mt-1">{shift ? `Anda bertugas di Shift ${shift}.` : <>Belum memilih shift. <Link className="text-sharp font-medium" to="/supply">Pilih sekarang</Link></>}</p></div>
      <div className="flex gap-2"><Link to="/produksi?baru=1" className="btn btn-secondary"><Plus size={18} />Produksi</Link><Link to="/supply" className="btn btn-primary"><PackageCheck size={18} />Catat supply</Link></div></div>

    <div className="flex items-center gap-2 mb-3"><input aria-label="Tanggal" type="date" className="input !w-auto" value={date} onChange={e => setDate(e.target.value)} />
      <button className={`chip gap-1.5 ${nFilters ? 'chip-on' : ''}`} onClick={() => setShowF(!showF)}><SlidersHorizontal size={15} />Filter{nFilters > 0 && ` (${nFilters})`}</button>{loading && <span className="text-xs text-mute">memuat…</span>}</div>
    {showF && <div className="surface p-3 mb-4 grid gap-2 grid-cols-2 md:grid-cols-4 animate-fade">
      <select className="input" value={fCat} onChange={e => setFCat(e.target.value)}><option value="">Semua kategori</option>{cats.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input className="input" placeholder="Cari model" value={fModel} onChange={e => setFModel(e.target.value)} />
      <select className="input" value={fLine} onChange={e => setFLine(e.target.value)}><option value="">Semua line</option>{lns.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className="input" value={fGroup} onChange={e => setFGroup(e.target.value)}><option value="">Semua group</option>{grps.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className="input" value={fShift} onChange={e => setFShift(e.target.value)}><option value="">Aktivitas semua shift</option><option value="1">Shift 1</option><option value="2">Shift 2</option><option value="3">Shift 3</option></select>
      <select className="input col-span-1 md:col-span-2" value={fSupply} onChange={e => setFSupply(e.target.value)}><option value="__all">Semua supply category</option>{sc.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button className="btn btn-ghost" onClick={() => { setFCat(''); setFLine(''); setFGroup(''); setFModel(''); setFSupply('__all'); setFShift('') }}>Reset</button></div>}

    <div className="surface mb-6 overflow-hidden"><div className="grid grid-cols-2 md:grid-cols-4">
      <Kpi label="Produksi berjalan" value={list.length} sub={`${list.reduce((a, p) => a + p.qty, 0).toLocaleString('id-ID')} unit`} />
      <Kpi edge="border-l border-line" label="Penyelesaian part" value={`${pct}%`} sub={`${tot.done} dari ${tot.items} part`} tone={pct === 100 && tot.items ? 'text-ok' : ''} />
      <Kpi edge="border-t md:border-t-0 md:border-l border-line" label="Transaksi hari ini" value={count ?? '…'} sub="semua shift" />
      <Kpi edge="border-t border-l md:border-t-0 border-line" label="Over supply" value={tot.over} sub={tot.over ? 'perlu dicek' : 'tidak ada'} tone={tot.over ? 'text-bad' : ''} /></div>
      <div className="px-4 pb-4 md:px-6"><Progress value={pct} tone={pct === 100 ? 'ok' : 'sharp'} /></div></div>

    <div className="grid lg:grid-cols-[1.5fr_1fr] gap-x-8">
      <div>
        <Section title="Progres per produksi" action={<Link to="/produksi" className="text-sm text-sharp font-medium inline-flex items-center">Semua<ChevronRight size={16} /></Link>}>
          {per.length === 0 ? <div className="surface"><Empty title="Belum ada produksi" hint="Buat produksi untuk tanggal ini agar supply bisa dicatat." /></div> :
            <ul className="surface divide-y divide-line">{per.map(({ p, s }) => { const done = s.completed + s.over; const v = s.items ? done * 100 / s.items : 0
              return <li key={p.id}><Link to={`/supply?prod=${p.id}&date=${p.date}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-canvas/60 transition-colors">
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-semibold truncate">{p.modelName}</span>{s.over > 0 && <Pill tone="bad">Over {s.over}</Pill>}{p.status === 'COMPLETED' && <Pill tone="ok">Selesai</Pill>}</div>
                  <p className="text-xs text-mute mt-0.5">{p.lineName} · {p.groupName} · {p.qty} unit</p><div className="mt-2"><Progress value={v} tone={v === 100 ? 'ok' : 'ink'} /></div></div>
                <div className="text-right shrink-0"><p className="text-xl font-bold num">{Math.round(v)}%</p><p className="text-[11px] text-mute num">{done}/{s.items}</p></div></Link></li> })}</ul>}</Section>
        <Section title="Aktivitas terbaru">{recentShown.length === 0 ? <div className="surface"><Empty title="Belum ada aktivitas" /></div> :
          <ul className="surface divide-y divide-line">{recentShown.map(t => <li key={t.id} className="flex items-center gap-3 px-4 py-3"><div className="flex-1 min-w-0"><p className="text-sm"><span className="font-semibold num">{t.partCode}</span><span className="text-mute"> · {t.modelName}</span></p><p className="text-xs text-mute">{t.operatorName} · Shift {t.shift} · {when(t.createdAt)}</p></div>
            <p className={`font-bold num ${t.type === 'OVER_SUPPLY' ? 'text-bad' : ''}`}>{t.qty} <span className="text-xs font-normal text-mute">{t.unit}</span></p></li>)}</ul>}</Section></div>
      <div>
        {(alerts.length > 0 || lagging.length > 0) && <Section title="Perlu perhatian"><div className="surface divide-y divide-line">
          {alerts.slice(0, 5).map(({ p, r }) => <div key={p.id + r.partId} className="flex gap-3 px-4 py-3"><AlertTriangle size={18} className="text-bad shrink-0 mt-0.5" /><div className="text-sm min-w-0"><p className="font-semibold">Over supply · {r.partCode}</p><p className="text-xs text-mute truncate">{p.modelName} · butuh {r.required}, diambil {r.taken} (lebih {-r.remaining})</p></div></div>)}
          {lagging.map(({ p, s }) => <Link key={p.id} to={`/supply?prod=${p.id}&date=${p.date}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60"><span className="w-2 h-2 rounded-full bg-warn shrink-0" /><div className="text-sm flex-1 min-w-0"><p className="font-semibold truncate">{p.modelName}</p><p className="text-xs text-mute">{s.items - s.completed - s.over} part belum selesai</p></div><ChevronRight size={16} className="text-mute" /></Link>)}</div></Section>}
        <Section title="Produksi per line"><Dist rows={byLine} /></Section>
        <Section title="Produksi per group"><Dist rows={byGroup} /></Section></div></div></div>
}

/** Supply (OPERATOR) gets the simplified home; LEADER/ADMIN keep the full operations dashboard. */
export default function Dashboard() { const { role } = useAuth(); return role === 'OPERATOR' ? <SupplyHome /> : <LeaderDashboard /> }
