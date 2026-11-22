import { Download } from 'lucide-react'
import { Empty, ErrorNote } from '../ui'
import { useMemo, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProgress } from '../lib/useProgress'
import { useCollection } from '../lib/useCollection'
import { aggregate, partProgress } from '../lib/report'
import { effectiveQty } from '../lib/takeLogic'
import { exportXlsx } from '../lib/exportXlsx'
import { todayStr } from '../lib/production'
import type { P } from './Production'
interface Tx { id: string; qty: number; shift: number; modelName: string; lineName: string; groupName: string; supplyCategoryName: string }
type Row = Record<string, string | number>
const CAP = 5000
const TABS = ['Per Model', 'Per Supply Category', 'Per Line', 'Per Group', 'Per Shift', 'Kekurangan', 'Over Supply'] as const
export default function Reports() {
  const sc = useCollection<{ name: string }>('supplyCategories')
  const [from, setFrom] = useState(todayStr()); const [to, setTo] = useState(todayStr()); const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0])
  const [data, setData] = useState<{ txs: Tx[]; rev: Set<string>; prods: P[]; capped: boolean } | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const load = async () => {
    setBusy(true); setErr('')
    try {
      const a = new Date(`${from}T00:00:00`), b = new Date(`${to}T00:00:00`); b.setDate(b.getDate() + 1); if (isNaN(a.getTime()) || isNaN(b.getTime()) || a >= b) throw new Error('Rentang tanggal tidak valid')
      const [t, r, p] = await Promise.all([
        getDocs(query(collection(db, 'supplyTransactions'), where('createdAt', '>=', a), where('createdAt', '<', b), orderBy('createdAt', 'desc'), limit(CAP + 1))),
        getDocs(query(collection(db, 'transactionAdjustments'), where('txCreatedAt', '>=', a), where('txCreatedAt', '<', b), orderBy('txCreatedAt', 'desc'), limit(CAP + 1))),
        getDocs(query(collection(db, 'productions'), where('date', '>=', from), where('date', '<=', to), orderBy('date')))])
      const adj = r.docs.map(d => d.data()); const delta = new Map(adj.filter(a => a.type === 'LOSS_PACK').map(a => [a.txId as string, a.qty as number]))
      setData({ txs: t.docs.slice(0, CAP).map(d => { const x = d.data() as Omit<Tx, 'id'>; return { id: d.id, ...x, qty: effectiveQty(x.qty, delta.get(d.id) ?? 0) } }), rev: new Set(adj.filter(a => a.type === 'REVERSAL').map(a => a.txId as string)), prods: p.docs.map(d => ({ id: d.id, ...(d.data() as Omit<P, 'id'>) })), capped: t.size > CAP })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const prods = useMemo(() => (data?.prods ?? []).filter(p => p.status !== 'CANCELLED'), [data]); const { lines, taken } = useProgress(prods.map(p => p.id))
  const agg = (key: (t: Tx) => string, label: string): Row[] => aggregate(data?.txs ?? [], data?.rev ?? new Set(), key).map(x => ({ [label]: x.key, 'Jumlah transaksi': x.count, 'Total qty': x.qty }))
  const scName = (id: string) => sc.items.find(c => c.id === id)?.name ?? 'Belum diatur'
  const progressRows = (only: 'short' | 'over'): Row[] => prods.flatMap(p => partProgress(lines[p.id] ?? [], p.qty, taken[p.id] ?? {}).filter(r => only === 'short' ? r.remaining > 0 : r.remaining < 0).map(r => ({ Tanggal: p.date, Model: p.modelName, Line: p.lineName, Group: p.groupName, 'Kode Part': r.partCode, 'Nama Part': r.partName, 'Supply Category': scName(r.supplyCategoryId), Butuh: r.required, Diambil: r.taken, [only === 'short' ? 'Kurang' : 'Lebih']: Math.abs(r.remaining), Unit: r.unit })))
  const rows: Row[] = !data ? [] : tab === 'Per Model' ? agg(t => t.modelName, 'Model') : tab === 'Per Supply Category' ? agg(t => t.supplyCategoryName || 'Belum diatur', 'Supply Category') : tab === 'Per Line' ? agg(t => t.lineName, 'Line')
    : tab === 'Per Group' ? agg(t => t.groupName, 'Group') : tab === 'Per Shift' ? agg(t => `Shift ${t.shift}`, 'Shift') : tab === 'Kekurangan' ? progressRows('short') : progressRows('over')
  const cols = rows[0] ? Object.keys(rows[0]) : []
  return <div>
    <div className="flex flex-wrap items-end gap-2 mb-4"><div><label className="label" htmlFor="rf">Dari</label><input id="rf" type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
      <div><label className="label" htmlFor="rt">Sampai</label><input id="rt" type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
      <button disabled={busy} className="btn btn-primary" onClick={load}>{busy ? 'Memuat…' : 'Tampilkan laporan'}</button></div>
    {err && <ErrorNote>{err}</ErrorNote>}
    {!data ? <div className="surface"><Empty title="Pilih rentang tanggal" hint="Laporan dimuat saat tombol ditekan agar hemat kuota." /></div> : <>
      {data.capped && <ErrorNote>Transaksi melebihi {CAP}. Laporan transaksi hanya mencakup {CAP} terbaru; persempit rentang tanggal.</ErrorNote>}
      <p className="text-xs text-mute my-2 px-1">{data.txs.length} transaksi · {prods.length} produksi (tanpa yang dibatalkan). Transaksi yang dikoreksi tidak dihitung. Total qty menjumlah semua part (satuan campur). Kekurangan dan over supply menunjukkan kondisi saat ini.</p>
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-line mb-3">{TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-3 min-h-11 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t ? 'border-sharp text-ink font-semibold' : 'border-transparent text-mute'}`}>{t}</button>)}</div>
      <div className="flex items-center mb-3"><p className="flex-1 text-sm text-mute num">{rows.length} baris</p><button disabled={!rows.length} className="btn btn-secondary btn-sm" onClick={() => exportXlsx(`laporan-${tab.toLowerCase().replace(/\s+/g, '-')}-${from}_${to}`, rows, tab)}><Download size={15} />Ekspor Excel</button></div>
      {rows.length === 0 ? <div className="surface"><Empty title="Tidak ada data" /></div> : <div className="surface overflow-x-auto"><table className="tbl"><thead><tr>{cols.map(c => <th key={c} className={typeof rows[0][c] === 'number' ? 'text-right' : ''}>{c}</th>)}</tr></thead><tbody>{rows.slice(0, 500).map((r, i) => <tr key={i}>{cols.map(c => <td key={c} className={typeof r[c] === 'number' ? 'text-right num' : ''}>{r[c]}</td>)}</tr>)}</tbody></table></div>}
      {rows.length > 500 && <p className="text-xs text-mute mt-2 px-1">Menampilkan 500 baris pertama; ekspor Excel memuat semua.</p>}</>}</div>
}
