import { useMemo, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProgress } from '../lib/useProgress'
import { useCollection } from '../lib/useCollection'
import { aggregate, partProgress } from '../lib/report'
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
      setData({ txs: t.docs.slice(0, CAP).map(d => ({ id: d.id, ...(d.data() as Omit<Tx, 'id'>) })), rev: new Set(r.docs.map(d => d.data().txId as string)), prods: p.docs.map(d => ({ id: d.id, ...(d.data() as Omit<P, 'id'>) })), capped: t.size > CAP })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const prods = useMemo(() => (data?.prods ?? []).filter(p => p.status !== 'CANCELLED'), [data]); const { lines, taken } = useProgress(prods.map(p => p.id))
  const agg = (key: (t: Tx) => string, label: string): Row[] => aggregate(data?.txs ?? [], data?.rev ?? new Set(), key).map(x => ({ [label]: x.key, 'Jumlah transaksi': x.count, 'Total qty': x.qty }))
  const scName = (id: string) => sc.items.find(c => c.id === id)?.name ?? 'Belum diatur'
  const progressRows = (only: 'short' | 'over'): Row[] => prods.flatMap(p => partProgress(lines[p.id] ?? [], p.qty, taken[p.id] ?? {}).filter(r => only === 'short' ? r.remaining > 0 : r.remaining < 0).map(r => ({ Tanggal: p.date, Model: p.modelName, Line: p.lineName, Group: p.groupName, 'Kode Part': r.partCode, 'Nama Part': r.partName, 'Supply Category': scName(r.supplyCategoryId), Butuh: r.required, Diambil: r.taken, [only === 'short' ? 'Kurang' : 'Lebih']: Math.abs(r.remaining), Unit: r.unit })))
  const rows: Row[] = !data ? [] : tab === 'Per Model' ? agg(t => t.modelName, 'Model') : tab === 'Per Supply Category' ? agg(t => t.supplyCategoryName || 'Belum diatur', 'Supply Category') : tab === 'Per Line' ? agg(t => t.lineName, 'Line')
    : tab === 'Per Group' ? agg(t => t.groupName, 'Group') : tab === 'Per Shift' ? agg(t => `Shift ${t.shift}`, 'Shift') : tab === 'Kekurangan' ? progressRows('short') : progressRows('over')
  const cols = rows[0] ? Object.keys(rows[0]) : []
  return <div className="space-y-4"><h2 className="text-lg font-bold">Laporan</h2>
    <div className="bg-white rounded-xl shadow p-3 grid grid-cols-2 gap-2"><label className="text-xs">Dari<input type="date" className="w-full border rounded-lg p-2" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-xs">Sampai<input type="date" className="w-full border rounded-lg p-2" value={to} onChange={e => setTo(e.target.value)} /></label>
      <button disabled={busy} className="col-span-2 bg-blue-600 disabled:opacity-40 text-white rounded-lg p-3 font-semibold" onClick={load}>{busy ? 'Memuat…' : 'Tampilkan laporan'}</button></div>
    {err && <p className="text-red-600">{err}</p>}
    {data && <>
      {data.capped && <p className="text-orange-600 text-sm">Transaksi melebihi {CAP}. Laporan transaksi hanya mencakup {CAP} terbaru; persempit rentang tanggal.</p>}
      <p className="text-xs text-slate-500">{data.txs.length} transaksi · {prods.length} produksi (tidak termasuk yang dibatalkan). Transaksi yang dikoreksi tidak dihitung. Total qty menjumlah semua part (satuan campur). Laporan kekurangan dan over supply menunjukkan kondisi saat ini.</p>
      <div className="flex gap-2 flex-wrap">{TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-lg text-sm ${tab === t ? 'bg-[#0b1f3a] text-white' : 'bg-white border'}`}>{t}</button>)}</div>
      <button disabled={!rows.length} className="border border-blue-600 text-blue-700 disabled:opacity-40 rounded-lg px-4 py-2 font-semibold" onClick={() => exportXlsx(`laporan-${tab.toLowerCase().replace(/\s+/g, '-')}-${from}_${to}`, rows, tab)}>Ekspor Excel ({rows.length} baris)</button>
      {rows.length === 0 ? <p className="text-slate-500">Tidak ada data.</p> : <div className="overflow-x-auto bg-white rounded-xl shadow"><table className="text-sm w-full"><thead><tr className="text-left">{cols.map(c => <th key={c} className="p-2 whitespace-nowrap">{c}</th>)}</tr></thead><tbody>{rows.slice(0, 500).map((r, i) => <tr key={i} className="border-t">{cols.map(c => <td key={c} className="p-2">{r[c]}</td>)}</tr>)}</tbody></table></div>}
      {rows.length > 500 && <p className="text-sm text-slate-500">Menampilkan 500 baris pertama; ekspor Excel memuat semua.</p>}</>}</div>
}
