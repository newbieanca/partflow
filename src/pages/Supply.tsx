import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { AlertTriangle, ChevronDown, ChevronLeft, Search } from 'lucide-react'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { useAuth } from '../auth/AuthContext'
import { remainingQty, requiredQty, sumQty, supplyStatus, takeAllQty } from '../lib/bom'
import { OverSupplyError, recordTake, reverseTransaction, type OverInfo } from '../lib/supply'
import { todayStr, type SnapLine } from '../lib/production'
import { setShift, useShift } from '../lib/shift'
import { useLive } from '../lib/useLive'
import { effectiveQty } from '../lib/takeLogic'
import { LossPackSheet } from '../components/LossPack'
import { when, type Ts } from '../lib/format'
import { Empty, Highlight, Pill, Progress, Sheet, StatusPill, Toast, useDialog } from '../ui'
import { useProgress } from '../lib/useProgress'
import { partProgress, summarizeProgress } from '../lib/report'
import { matchesCategory, NO_CATEGORY, useOpCat, useOpName } from '../lib/supplyProfile'
import { useProductions, type P } from './Production'
interface Tx { id: string; partId: string; qty: number; shift: number; type: string; operatorName: string; createdAt: Ts }
interface Adj { id: string; txId: string; type: string; qty: number; note?: string; userName?: string }
const ms = (t: Ts) => t?.toDate ? t.toDate().getTime() : Infinity
type Take = { partId: string; mode: 'ALL' | 'PARTIAL'; value: string; over?: OverInfo }
export default function Supply() {
  const { user, role } = useAuth(); const leaderUp = role === 'ADMIN' || role === 'LEADER'; const isSupply = role === 'OPERATOR'; const opName = useOpName().trim(); const opCat = useOpCat(); const uname = isSupply && opName ? opName : (user?.displayName ?? user?.email ?? ''); const { prompt } = useDialog(); const [sp] = useSearchParams()
  const cats = useCollection<{ name: string }>('supplyCategories'); const shift = useShift()
  const [date, setDate] = useState(sp.get('date') ?? todayStr()); const { items: prods } = useProductions(date)
  const [prodId, setProdId] = useState(sp.get('prod') ?? ''); const prod = prods.find(p => p.id === prodId)
  const [catF, setCatF] = useState('__all'); const [q, setQ] = useState(''); const [pending, setPending] = useState(false)
  const [lines, setLines] = useState<SnapLine[]>([])
  useEffect(() => { setLines([]); if (!prodId) return; return onSnapshot(doc(db, 'productionBomSnapshots', prodId), s => setLines(s.exists() ? (s.data().lines as SnapLine[]) : [])) }, [prodId])
  const txs = useLive<Tx>('supplyTransactions', prodId); const adjs = useLive<Adj>('transactionAdjustments', prodId)
  const reversed = useMemo(() => new Set(adjs.filter(a => a.type === 'REVERSAL').map(a => a.txId)), [adjs]); const lpMap = useMemo(() => new Map(adjs.filter(a => a.type === 'LOSS_PACK').map(a => [a.txId, a])), [adjs])
  const rows = useMemo(() => {
    if (!prod) return []
    const by = new Map<string, { taken: number; shifts: Record<number, number>; list: Tx[] }>()
    txs.forEach(t => { const e = by.get(t.partId) ?? { taken: 0, shifts: {}, list: [] }; e.list.push(t); if (!reversed.has(t.id)) { const q = effectiveQty(t.qty, lpMap.get(t.id)?.qty ?? 0); e.taken = sumQty(e.taken, q); e.shifts[t.shift] = sumQty(e.shifts[t.shift] ?? 0, q) } by.set(t.partId, e) })
    return lines.map(l => { const required = requiredQty(l.qtyPerUnit, prod.qty); const e = by.get(l.partId) ?? { taken: 0, shifts: {}, list: [] as Tx[] }
      return { ...l, required, taken: e.taken, remaining: remainingQty(required, e.taken), status: supplyStatus(required, e.taken), shifts: e.shifts, list: [...e.list].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)) } }).sort((a, b) => a.partCode.localeCompare(b.partCode))
  }, [prod, lines, txs, reversed, lpMap])
  type Row = (typeof rows)[number]
  const catName = (id: string) => cats.items.find(c => c.id === id)?.name ?? ''
  const present = useMemo(() => [...new Set(rows.map(r => r.supplyCategoryId))], [rows])
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = rows.filter(r => (isSupply ? matchesCategory(opCat, r.supplyCategoryId) : (catF === '__all' || r.supplyCategoryId === catF)) && (!pending || r.status !== 'COMPLETED') && tokens.every(t => `${r.partCode} ${r.partName}`.toLowerCase().includes(t)))
  const count = (s: string) => rows.filter(r => r.status === s).length
  const [take, setTake] = useState<Take | null>(null); const cur = take ? rows.find(r => r.partId === take.partId) : undefined
  const [openPart, setOpenPart] = useState(''); const [lpPart, setLpPart] = useState(''); const [busy, setBusy] = useState(false); const [toast, setToast] = useState<{ m: string; t: 'ok' | 'bad' }>({ m: '', t: 'ok' }); const keys = useRef<Record<string, string>>({})
  const go = async (r: Row, mode: 'TAKE_ALL' | 'PARTIAL', qty: number, confirmOver: boolean) => {
    if (!shift) return setToast({ m: 'Pilih shift aktif Anda dulu.', t: 'bad' })
    if (isSupply && !opName) return setToast({ m: 'Isi nama Anda di Beranda dulu.', t: 'bad' })
    setBusy(true); const key = (keys.current[r.partId] ??= crypto.randomUUID()) // same key on retry = no duplicate
    try {
      const res = await recordTake(db, { idempotencyKey: key, productionId: prodId, partId: r.partId, mode, qty, shift, confirmOver, notes: '', supplyCategoryName: catName(r.supplyCategoryId), user: { uid: user!.uid, name: uname } })
      delete keys.current[r.partId]; setTake(null)
      setToast({ m: res.duplicate ? 'Transaksi ini sudah tercatat sebelumnya (tidak dobel).' : `Tercatat: ${r.partCode} · ${res.qty} ${r.unit} · Shift ${shift}`, t: 'ok' })
    } catch (e) {
      if (e instanceof OverSupplyError) setTake({ partId: r.partId, mode: 'PARTIAL', value: String(qty), over: e.info })
      else { const m = (e as Error).message; setToast({ m: m.includes('offline') || m.includes('unavailable') ? 'Tidak ada koneksi. Tidak ada data yang tersimpan; coba lagi saat online.' : m, t: 'bad' }) }
    } finally { setBusy(false) }
  }
  const correct = async (txId: string) => { const reason = await prompt({ title: 'Koreksi transaksi', message: 'Transaksi dibatalkan, data asli tetap tersimpan. Tulis alasannya.', confirmLabel: 'Koreksi', danger: true }); if (!reason) return; try { await reverseTransaction(db, { txId, reason, user: { uid: user!.uid, name: uname } }); setToast({ m: 'Koreksi tercatat.', t: 'ok' }) } catch (e) { setToast({ m: (e as Error).message, t: 'bad' }) } }
  const active = prod?.status === 'ACTIVE'
  const closeSheet = () => { if (!busy) setTake(null) }
  if (isSupply && (!opName || !opCat)) return <div className="surface"><Empty title="Lengkapi data tugas Anda" hint="Isi nama dan pilih kategori supply di Beranda agar hanya part kategori Anda yang tampil." /><div className="pb-6 text-center"><Link to="/" className="btn btn-primary">Ke Beranda</Link></div></div>
  const myCatLabel = opCat === NO_CATEGORY ? 'Belum diatur' : catName(opCat)
  return <div>
    {isSupply ? <div className="mb-4"><label className="label" htmlFor="sd2">Tanggal</label><input id="sd2" type="date" className="input !w-auto" value={date} onChange={e => { setDate(e.target.value); setProdId('') }} /></div> : <div className="surface p-3 mb-4 grid grid-cols-[auto_1fr] gap-2 items-end">
      <div><label className="label" htmlFor="sd">Tanggal</label><input id="sd" type="date" className="input" value={date} onChange={e => { setDate(e.target.value); setProdId('') }} /></div>
      <div><label className="label" htmlFor="sp">Produksi</label><select id="sp" className="input" value={prodId} onChange={e => { setProdId(e.target.value); setTake(null); setCatF('__all') }}><option value="">Pilih produksi…</option>{prods.filter(p => p.status !== 'CANCELLED').map(p => <option key={p.id} value={p.id}>{p.modelName} · {p.lineName}/{p.groupName} · {p.qty}{p.status === 'COMPLETED' ? ' (selesai)' : ''}</option>)}</select></div></div>}

    {!prod ? (isSupply ? <ModelPicker prods={prods} opCat={opCat} onPick={id => { setProdId(id); setTake(null) }} /> : <div className="surface"><Empty title="Pilih produksi" hint="Pilih tanggal dan produksi untuk mulai mencatat pengambilan part." /></div>) : <>
      {isSupply && <button className="btn btn-ghost btn-sm -ml-2 mb-2" onClick={() => { setProdId(''); setTake(null) }}><ChevronLeft size={18} />Ganti model</button>}
      <div className="mb-4">
        <div className="flex items-start gap-3"><div className="flex-1 min-w-0"><h2 className="text-2xl font-bold tracking-tight leading-tight">{prod.modelName}</h2>
          <p className="text-sm text-mute mt-1">{prod.lineName} · {prod.groupName} · <span className="num font-medium text-ink2">{prod.qty.toLocaleString('id-ID')} unit</span> · BOM v{prod.bomVersion}</p></div>{!active && <StatusPill status={prod.status} />}</div>
        <div className="mt-3 flex items-center gap-3"><span className="text-xs font-medium text-mute">Shift Anda</span>
          <div className="inline-flex rounded-lg bg-white border border-line p-0.5" role="group" aria-label="Pilih shift">{[1, 2, 3].map(n => <button key={n} aria-pressed={shift === n} onClick={() => setShift(n)} className={`min-w-14 min-h-10 rounded-md text-sm font-semibold transition-colors ${shift === n ? 'bg-ink text-white' : 'text-ink2'}`}>{n}</button>)}</div>
          {!shift && <span className="text-xs text-amber-800 font-medium">Pilih dulu</span>}</div>
        {!active && <p className="mt-3 text-sm text-amber-800 bg-amber-50 rounded-lg p-3">Produksi {prod.status}. Pengambilan part dikunci; minta Leader atau Admin membukanya kembali.</p>}</div>

      <div className="sticky z-10 bg-canvas/95 backdrop-blur -mx-4 md:-mx-8 px-4 md:px-8 pt-2 pb-3 border-b border-line mb-3" style={{ top: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        {isSupply && <p className="text-xs text-mute mb-2">Kategori <b className="text-ink">{myCatLabel}</b> · {opName} · <Link to="/" className="text-sharp font-medium">Ubah</Link></p>}
        <div className="relative mb-2"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" /><input aria-label="Cari part" className="input !pl-10" placeholder="Cari kode atau nama part" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {!isSupply && <><button className={`chip ${catF === '__all' ? 'chip-on' : ''}`} onClick={() => setCatF('__all')}>Semua</button>
          {present.map(id => <button key={id || 'none'} className={`chip ${catF === id ? 'chip-on' : ''}`} onClick={() => setCatF(id)}>{id ? catName(id).replace(/^Supply\s+/i, '') : 'Belum diatur'}</button>)}</>}
          <button className={`chip ${pending ? 'chip-on' : ''}`} onClick={() => setPending(!pending)}>Belum selesai</button></div></div>
      <p className="text-xs text-mute mb-2 px-1 num">{shown.length} dari {rows.length} part · <span className="text-green-700">{count('COMPLETED')} selesai</span> · {count('PARTIAL')} sebagian · {count('NOT_TAKEN')} belum{count('OVER_SUPPLY') > 0 && <b className="text-bad"> · {count('OVER_SUPPLY')} over</b>}</p>

      {shown.length === 0 ? <div className="surface"><Empty title="Tidak ada part" hint="Ubah pencarian atau filter supply category." /></div> :
        <ul className="surface divide-y divide-line overflow-hidden">{shown.slice(0, 150).map(r => { const pct = r.required ? r.taken * 100 / r.required : 0; const ta = takeAllQty(r.required, r.taken); const open = openPart === r.partId
          return <li key={r.partId} className="px-4 py-3.5">
            <div className="flex gap-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-bold num text-[15px]"><Highlight text={r.partCode} tokens={tokens} /></span><StatusPill status={r.status} /></div>
              <p className="text-sm text-ink2 mt-0.5 line-clamp-2"><Highlight text={r.partName} tokens={tokens} /></p><p className="text-xs text-mute mt-0.5">{catName(r.supplyCategoryId) || 'Supply category belum diatur'} · {r.qtyPerUnit}/unit</p></div>
              <div className="text-right shrink-0"><p className="text-[11px] text-mute">Sisa</p><p className={`text-[32px] font-extrabold leading-none tracking-tight num ${r.remaining < 0 ? 'text-bad' : r.remaining === 0 ? 'text-ok' : ''}`}>{r.remaining < 0 ? `+${-r.remaining}` : r.remaining}</p><p className="text-[11px] text-mute mt-0.5">{r.unit}</p></div></div>
            <div className="mt-2.5"><Progress value={pct} tone={r.status === 'OVER_SUPPLY' ? 'bad' : r.status === 'COMPLETED' ? 'ok' : 'sharp'} /><div className="flex justify-between text-[11px] text-mute mt-1 num"><span>Diambil {r.taken} dari {r.required}</span><span>S1 {r.shifts[1] ?? 0} · S2 {r.shifts[2] ?? 0} · S3 {r.shifts[3] ?? 0}</span></div></div>
            {active && <div className="grid grid-cols-[1fr_auto] gap-2 mt-3"><button disabled={busy || !ta} className="btn btn-primary" onClick={() => { delete keys.current[r.partId]; setTake({ partId: r.partId, mode: 'ALL', value: '' }) }}>{ta ? `Ambil semua · ${ta}` : 'Sudah penuh'}</button>
              <button disabled={busy} className="btn btn-secondary" onClick={() => { delete keys.current[r.partId]; setTake({ partId: r.partId, mode: 'PARTIAL', value: '' }) }}>Sebagian</button></div>}
            <button className="mt-2 inline-flex items-center gap-1 text-xs text-mute font-medium" aria-expanded={open} onClick={() => setOpenPart(open ? '' : r.partId)}>Riwayat ({r.list.length})<ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} /></button>
            {r.list.length > 0 && <button className="mt-2 ml-4 text-xs text-sharp font-medium" onClick={() => setLpPart(r.partId)}>Edit loss pack</button>}
            {open && <ul className="mt-1 text-sm divide-y divide-line animate-fade">{r.list.length === 0 && <li className="py-2 text-mute">Belum ada pengambilan.</li>}{r.list.map(t => <li key={t.id} className="py-2 flex gap-2 items-center"><div className="flex-1 min-w-0"><div className={reversed.has(t.id) ? 'line-through text-mute' : ''}><span className="font-semibold num">{effectiveQty(t.qty, lpMap.get(t.id)?.qty ?? 0)}</span>{lpMap.has(t.id) && <span className="text-xs text-mute num"> (semula {t.qty})</span>} · Shift {t.shift} · {t.operatorName}</div><div className="text-xs text-mute">{when(t.createdAt)}</div>{lpMap.get(t.id) && <div className="text-xs text-amber-800">Loss pack: {lpMap.get(t.id)!.note}{lpMap.get(t.id)!.userName && ` (${lpMap.get(t.id)!.userName})`}</div>}</div>
              {t.type === 'OVER_SUPPLY' && <Pill tone="bad">Over</Pill>}{lpMap.has(t.id) && <Pill tone="warn">Loss pack</Pill>}{reversed.has(t.id) ? <Pill>Dikoreksi</Pill> : leaderUp && <button className="btn btn-ghost btn-sm" onClick={() => correct(t.id)}>Koreksi</button>}</li>)}</ul>}</li> })}</ul>}
      {shown.length > 150 && <p className="text-xs text-mute mt-2 px-1">Menampilkan 150 pertama. Persempit dengan pencarian atau kategori.</p>}</>}

    <Sheet open={!!take && !!cur} onClose={closeSheet} title={cur ? cur.partCode : ''}>
      {take && cur && <div>
        <p className="text-sm text-ink2 -mt-1 mb-4">{cur.partName}</p>
        <div className="grid grid-cols-3 text-center divide-x divide-line rounded-xl bg-canvas py-3 mb-4">{[['Butuh', cur.required, ''], ['Diambil', cur.taken, ''], ['Sisa', cur.remaining, cur.remaining < 0 ? 'text-bad' : '']].map(([l, v, c]) => <div key={l as string}><p className="text-[11px] text-mute">{l}</p><p className={`text-2xl font-bold num ${c}`}>{v}</p></div>)}</div>
        <p className="text-sm text-mute mb-4">Dicatat untuk <b className="text-ink">Shift {shift || '?'}</b> atas nama <b className="text-ink">{uname}</b></p>
        {take.over ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3" role="alert">
          <p className="flex items-center gap-2 font-bold text-bad"><AlertTriangle size={18} />Melebihi kebutuhan (over supply)</p>
          <p className="text-sm text-ink2">Kebutuhan <b className="num">{take.over.required}</b> · sudah diambil <b className="num">{take.over.taken}</b> · sisa <b className="num">{Math.max(0, take.over.remaining)}</b>. Jumlah <b className="num">{take.value}</b> akan menambah kelebihan <b className="text-bad num">{take.over.excess}</b>.</p>
          <div className="grid grid-cols-2 gap-2"><button disabled={busy} className="btn btn-secondary btn-lg" onClick={() => setTake({ partId: take.partId, mode: 'PARTIAL', value: take.value })}>Ubah jumlah</button><button disabled={busy} className="btn btn-danger btn-lg" onClick={() => go(cur, 'PARTIAL', Number(take.value), true)}>Catat over supply</button></div></div>
        : take.mode === 'ALL' ? <><p className="text-center mb-4">Ambil semua sisa<br /><span className="text-4xl font-extrabold num">{takeAllQty(cur.required, cur.taken)}</span> <span className="text-mute">{cur.unit}</span></p>
          <button disabled={busy || !shift} className="btn btn-primary btn-lg w-full" onClick={() => go(cur, 'TAKE_ALL', 0, false)}>{busy ? 'Menyimpan…' : 'Ambil semua'}</button></>
        : <><div className="flex items-center gap-2 mb-1"><label className="label !mb-0 flex-1" htmlFor="qty">Jumlah yang diambil ({cur.unit})</label>{cur.remaining > 0 && <button className="chip" onClick={() => { delete keys.current[cur.partId]; setTake({ ...take, value: String(cur.remaining) }) }}>Isi sisa ({cur.remaining})</button>}</div>
          <input id="qty" autoFocus type="number" inputMode="decimal" min="0" step="any" className="input !text-3xl !font-bold !min-h-16 text-center num mb-4" placeholder="0" value={take.value} onChange={e => { delete keys.current[cur.partId]; setTake({ ...take, value: e.target.value }) }} onKeyDown={e => e.key === 'Enter' && Number(take.value) > 0 && go(cur, 'PARTIAL', Number(take.value), false)} />
          <button disabled={busy || !shift || !(Number(take.value) > 0)} className="btn btn-primary btn-lg w-full" onClick={() => go(cur, 'PARTIAL', Number(take.value), false)}>{busy ? 'Menyimpan…' : 'Catat pengambilan'}</button></>}
        {!shift && <p className="text-sm text-amber-800 mt-3">Pilih shift Anda dulu di bagian atas halaman.</p>}</div>}</Sheet>
    <LossPackSheet open={!!lpPart} onClose={() => setLpPart('')} productionId={prodId} partId={lpPart} title="Edit loss pack" />
    <Toast msg={toast.m} tone={toast.t} onClose={() => setToast({ m: '', t: 'ok' })} /></div>
}

/** Supply picks a production by tapping its card (same look as the Production page) instead of a dropdown. */
function ModelPicker({ prods, opCat, onPick }: { prods: P[]; opCat: string; onPick: (id: string) => void }) {
  const list = prods.filter(p => p.status !== 'CANCELLED').sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || a.lineName.localeCompare(b.lineName) || a.modelName.localeCompare(b.modelName))
  const { lines, taken } = useProgress(list.slice(0, 40).map(p => p.id))
  if (list.length === 0) return <div className="surface"><Empty title="Belum ada jadwal produksi" hint="Belum ada produksi untuk tanggal ini. Jadwal diinput oleh Leader atau Admin." /></div>
  return <><p className="text-sm text-mute mb-2 px-1">Pilih model yang akan disupply</p>
    <ul className="surface divide-y divide-line overflow-hidden">{list.map(p => {
      const s = summarizeProgress(partProgress(lines[p.id] ?? [], p.qty, taken[p.id] ?? {}, opCat === NO_CATEGORY ? '' : opCat)); const done = s.completed + s.over; const v = s.items ? done * 100 / s.items : 0
      return <li key={p.id}><button className="relative w-full text-left pl-5 pr-4 py-4 flex gap-4 hover:bg-canvas/60 transition-colors" onClick={() => onPick(p.id)}>
        <span className={`absolute left-0 top-0 bottom-0 w-1 ${p.status === 'ACTIVE' ? 'bg-sharp' : 'bg-ok'}`} />
        <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-[17px] leading-tight">{p.modelName}</h3>{p.status === 'COMPLETED' && <StatusPill status="COMPLETED" />}{s.over > 0 && <Pill tone="bad">Over {s.over}</Pill>}</div>
          <p className="text-xs text-mute mt-1">{p.lineName} · {p.groupName} · {p.productCategoryName}</p>
          {s.items > 0 ? <div className="mt-3 flex items-center gap-3"><div className="flex-1"><Progress value={v} tone={v === 100 ? 'ok' : 'sharp'} /></div><span className="text-xs text-mute num whitespace-nowrap">{done}/{s.items} part Anda</span></div>
            : lines[p.id] ? <p className="text-xs text-mute mt-2">Tidak ada part untuk kategori Anda</p> : null}</div>
        <div className="text-right shrink-0"><p className="text-3xl font-bold tracking-tight num leading-none">{p.qty.toLocaleString('id-ID')}</p><p className="text-xs text-mute mt-1">unit</p></div></button></li> })}</ul></>
}
