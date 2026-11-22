import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ChevronLeft, ChevronRight, PackageCheck } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../auth/AuthContext'
import { useCollection } from '../lib/useCollection'
import { todayStr } from '../lib/production'
import { setShift, useShift } from '../lib/shift'
import { addDays, NO_CATEGORY, setHideActivity, setOpCat, setOpName, useHideActivity, useOpCat, useOpName } from '../lib/supplyProfile'
import { when, type Ts } from '../lib/format'
import { Empty, ErrorNote, Pill, Section, StatusPill } from '../ui'
import { useProductions } from './Production'
interface Cat { name: string; active?: boolean }
interface Tx { id: string; createdAt: Ts; modelName: string; supplyCategoryName: string; partCode: string; qty: number; unit: string; operatorName: string; shift: number; type: string }
const RAIL = { ACTIVE: 'bg-sharp', COMPLETED: 'bg-ok', CANCELLED: 'bg-line' } as const
const dayLabel = (d: string) => d === todayStr() ? 'Hari ini' : d === addDays(todayStr(), 1) ? 'Besok' : d === addDays(todayStr(), -1) ? 'Kemarin' : new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long' })
export default function SupplyHome() {
  const { user } = useAuth(); const name = useOpName(); const cat = useOpCat(); const shift = useShift(); const hide = useHideActivity()
  const cats = useCollection<Cat>('supplyCategories'); const [date, setDate] = useState(todayStr()); const { items, err } = useProductions(date); const [editing, setEditing] = useState(false)
  const catList = cats.items.filter(c => c.active !== false).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const catLabel = cat === NO_CATEGORY ? 'Belum diatur' : cats.items.find(c => c.id === cat)?.name ?? ''
  const complete = !!name.trim() && !!cat && !!shift; const open = editing || !complete
  const schedule = items.filter(p => p.status !== 'CANCELLED').sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || a.lineName.localeCompare(b.lineName) || a.modelName.localeCompare(b.modelName))
  const [recent, setRecent] = useState<Tx[]>([])
  useEffect(() => { if (hide) return; return onSnapshot(query(collection(db, 'supplyTransactions'), orderBy('createdAt', 'desc'), limit(40)), s => setRecent(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Tx, 'id'>) })))) }, [hide])
  const mine = recent.filter(t => cat === NO_CATEGORY ? !t.supplyCategoryName : !!catLabel && t.supplyCategoryName === catLabel).slice(0, 8)
  const first = (name.trim() || user?.displayName || user?.email || '').split(/[\s@]/)[0]
  return <div>
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[14rem]"><p className="text-sm text-mute">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Halo{first ? `, ${first}` : ''}</h2></div>
      <Link to="/supply" className="btn btn-primary"><PackageCheck size={18} />Catat supply</Link></div>

    <div className={`surface p-4 mb-6 ${complete ? '' : 'border-l-4 !border-l-sharp'}`}>
      {open ? <div className="space-y-4">
        <div><p className="font-semibold">{complete ? 'Ubah data tugas' : 'Isi dulu sebelum mulai'}</p><p className="text-sm text-mute">Nama, kategori supply, dan shift dipakai untuk mencatat pengambilan part dan menyaring tampilan.</p></div>
        <div><label className="label" htmlFor="opn">Nama Anda</label><input id="opn" className="input" autoComplete="off" placeholder="Contoh: Budi" value={name} onChange={e => setOpName(e.target.value)} /></div>
        <div><p className="label">Kategori supply Anda</p><div className="flex flex-wrap gap-2" role="group" aria-label="Kategori supply">
          {catList.map(c => <button key={c.id} aria-pressed={cat === c.id} className={`chip ${cat === c.id ? 'chip-on' : ''}`} onClick={() => setOpCat(c.id)}>{c.name}</button>)}
          <button aria-pressed={cat === NO_CATEGORY} className={`chip ${cat === NO_CATEGORY ? 'chip-on' : ''}`} onClick={() => setOpCat(NO_CATEGORY)}>Belum diatur</button></div></div>
        <div><p className="label">Shift</p><div className="inline-flex rounded-lg bg-canvas p-0.5" role="group" aria-label="Pilih shift">{[1, 2, 3].map(n => <button key={n} aria-pressed={shift === n} onClick={() => setShift(n)} className={`min-w-16 min-h-11 rounded-md text-sm font-semibold transition-colors ${shift === n ? 'bg-ink text-white' : 'text-ink2'}`}>Shift {n}</button>)}</div></div>
        {complete && <button className="btn btn-primary w-full" onClick={() => setEditing(false)}>Selesai</button>}</div>
      : <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-full bg-ink text-white grid place-items-center font-bold shrink-0">{name.trim().charAt(0).toUpperCase()}</span>
        <div className="flex-1 min-w-0"><p className="font-semibold truncate">{name.trim()}</p><p className="text-sm text-mute truncate">{catLabel || 'Kategori?'} · Shift {shift}</p></div>
        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Ubah</button></div>}</div>

    <Section title="Jadwal produksi" action={<div className="flex items-center gap-1">
      <button aria-label="Hari sebelumnya" className="btn btn-ghost btn-sm !px-2" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={18} /></button>
      <button className="chip" onClick={() => setDate(todayStr())}>{dayLabel(date)}</button>
      <button aria-label="Hari berikutnya" className="btn btn-ghost btn-sm !px-2" onClick={() => setDate(addDays(date, 1))}><ChevronRight size={18} /></button></div>}>
      <p className="text-xs text-mute mb-2 px-1">{new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })} · diinput oleh Leader atau Admin</p>
      {err && <ErrorNote>{err}</ErrorNote>}
      {schedule.length === 0 ? <div className="surface"><Empty title="Belum ada jadwal produksi" hint="Jadwal untuk tanggal ini belum diinput. Coba tanggal lain atau hubungi Leader." /></div> :
        <ul className="surface divide-y divide-line overflow-hidden">{schedule.map(p => <li key={p.id}><Link to={`/supply?prod=${p.id}&date=${p.date}`} className="relative flex items-center gap-4 pl-5 pr-4 py-4 hover:bg-canvas/60 transition-colors">
          <span className={`absolute left-0 top-0 bottom-0 w-1 ${RAIL[p.status]}`} />
          <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-[17px] leading-tight">{p.modelName}</span>{p.status === 'COMPLETED' && <StatusPill status="COMPLETED" />}</div>
            <p className="text-xs text-mute mt-1">{p.lineName} · {p.groupName} · {p.productCategoryName}</p>{p.notes && <p className="text-xs text-ink2 mt-0.5">{p.notes}</p>}<p className="text-[11px] text-mute mt-0.5">Diinput {p.createdByName}</p></div>
          <div className="text-right shrink-0"><p className="text-3xl font-bold tracking-tight num leading-none">{p.qty.toLocaleString('id-ID')}</p><p className="text-xs text-mute mt-1">unit</p></div></Link></li>)}</ul>}</Section>

    <Section title="Aktivitas terbaru" action={<button className="text-sm text-sharp font-medium" aria-expanded={!hide} onClick={() => setHideActivity(!hide)}>{hide ? 'Tampilkan' : 'Sembunyikan'}</button>}>
      {hide ? <p className="text-xs text-mute px-1">Disembunyikan.</p> : !catLabel ? <div className="surface"><Empty title="Pilih kategori supply" hint="Aktivitas ditampilkan untuk kategori Anda." /></div> : mine.length === 0 ? <div className="surface"><Empty title="Belum ada aktivitas" hint={`Belum ada pengambilan untuk ${catLabel}.`} /></div> :
        <ul className="surface divide-y divide-line overflow-hidden">{mine.map(t => <li key={t.id} className="flex items-center gap-3 px-4 py-3"><div className="flex-1 min-w-0"><p className="text-sm"><span className="font-semibold num">{t.partCode}</span><span className="text-mute"> · {t.modelName}</span></p><p className="text-xs text-mute">{t.operatorName} · Shift {t.shift} · {when(t.createdAt)}</p></div>
          <p className={`font-bold num ${t.type === 'OVER_SUPPLY' ? 'text-bad' : ''}`}>{t.qty} <span className="text-xs font-normal text-mute">{t.unit}</span></p>{t.type === 'OVER_SUPPLY' && <Pill tone="bad">Over</Pill>}</li>)}</ul>}</Section>
  </div>
}
