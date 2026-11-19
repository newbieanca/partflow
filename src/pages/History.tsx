import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { todayStr } from '../lib/production'
import { when, type Ts } from '../lib/format'
import { exportXlsx } from '../lib/exportXlsx'
interface Tx { id: string; createdAt: Ts; modelName: string; productCategoryName: string; lineName: string; groupName: string; supplyCategoryName: string; partCode: string; partName: string; qty: number; unit: string; operatorName: string; shift: number; type: string }
export default function History() {
  const [from, setFrom] = useState(todayStr()); const [to, setTo] = useState(todayStr()); const [n, setN] = useState(300)
  const [shift, setShift] = useState(''); const [type, setType] = useState(''); const [q, setQ] = useState('')
  const [txs, setTxs] = useState<Tx[]>([]); const [rev, setRev] = useState<Set<string>>(new Set()); const [err, setErr] = useState('')
  useEffect(() => {
    const a = new Date(`${from}T00:00:00`), b = new Date(`${to}T00:00:00`); b.setDate(b.getDate() + 1)
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return
    const u1 = onSnapshot(query(collection(db, 'supplyTransactions'), where('createdAt', '>=', a), where('createdAt', '<', b), orderBy('createdAt', 'desc'), limit(n)), s => setTxs(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Tx, "id">) }))), e => setErr(e.message))
    const u2 = onSnapshot(query(collection(db, 'transactionAdjustments'), where('txCreatedAt', '>=', a), where('txCreatedAt', '<', b), orderBy('txCreatedAt', 'desc'), limit(n)), s => setRev(new Set(s.docs.map(d => d.data().txId as string))), e => setErr(e.message))
    return () => { u1(); u2() }
  }, [from, to, n])
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = useMemo(() => txs.filter(t => (!shift || t.shift === Number(shift)) && (!type || t.type === type) && tokens.every(k => `${t.partCode} ${t.partName} ${t.modelName} ${t.operatorName} ${t.lineName} ${t.groupName} ${t.supplyCategoryName}`.toLowerCase().includes(k))), [txs, shift, type, q])
  const sel = 'border rounded-lg p-2 bg-white'
  return <div className="space-y-4"><h2 className="text-lg font-bold">Riwayat Pengambilan Part</h2>
    <div className="bg-white rounded-xl shadow p-3 grid gap-2 grid-cols-2 sm:grid-cols-3">
      <label className="text-xs">Dari<input type="date" className={sel + ' w-full'} value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="text-xs">Sampai<input type="date" className={sel + ' w-full'} value={to} onChange={e => setTo(e.target.value)} /></label>
      <select className={sel} value={shift} onChange={e => setShift(e.target.value)}><option value="">Semua shift</option><option>1</option><option>2</option><option>3</option></select>
      <select className={sel} value={type} onChange={e => setType(e.target.value)}><option value="">Semua tipe</option><option value="TAKE_ALL">Take All</option><option value="PARTIAL">Partial</option><option value="OVER_SUPPLY">Over supply</option></select>
      <input className={sel + ' col-span-2'} placeholder="Cari part, model, operator, line, group, supply category…" value={q} onChange={e => setQ(e.target.value)} /></div>
    <button disabled={!shown.length} className="border border-blue-600 text-blue-700 disabled:opacity-40 rounded-lg px-4 py-2 font-semibold" onClick={() => exportXlsx(`riwayat-${from}_${to}`, shown.map(t => ({ Waktu: t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('id-ID') : '', Model: t.modelName, Kategori: t.productCategoryName, Line: t.lineName, Group: t.groupName, 'Supply Category': t.supplyCategoryName, 'Kode Part': t.partCode, 'Nama Part': t.partName, Qty: t.qty, Unit: t.unit, Operator: t.operatorName, Shift: t.shift, Tipe: t.type, Dikoreksi: rev.has(t.id) ? 'Ya' : '' })), 'Riwayat')}>Ekspor Excel sesuai filter ({shown.length})</button>
    {err && <p className="text-red-600">{err}</p>}
    <p className="text-sm text-slate-500">{shown.length} transaksi{txs.length >= n && ' (dibatasi; tekan Muat lebih banyak)'} · yang dicoret sudah dikoreksi</p>
    <ul className="space-y-2">{shown.map(t => <li key={t.id} className={`bg-white rounded-xl shadow p-3 text-sm ${rev.has(t.id) ? 'opacity-50' : ''}`}>
      <div className="flex gap-2"><b className={`flex-1 ${rev.has(t.id) ? 'line-through' : ''}`}>{t.partCode} · {t.partName}</b><b className={t.type === 'OVER_SUPPLY' ? 'text-red-600' : ''}>{t.qty} {t.unit}</b></div>
      <p className="text-slate-600">{t.modelName} · {t.lineName} · {t.groupName} · {t.supplyCategoryName || '-'}</p>
      <p className="text-slate-500">{when(t.createdAt)} · {t.operatorName} · Shift {t.shift} · {t.type.replace('_', ' ')}{rev.has(t.id) && ' · DIKOREKSI'}</p></li>)}</ul>
    {txs.length >= n && <button className="w-full border rounded-lg p-3" onClick={() => setN(n + 300)}>Muat lebih banyak</button>}</div>
}
