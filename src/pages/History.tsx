import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { ChevronDown, Download, Search, SlidersHorizontal } from 'lucide-react'
import { db } from '../lib/firebase'
import { todayStr } from '../lib/production'
import { when, type Ts } from '../lib/format'
import { exportXlsx } from '../lib/exportXlsx'
import { Empty, ErrorNote, Highlight, Pill, StatusPill } from '../ui'
interface Tx { id: string; createdAt: Ts; modelName: string; productCategoryName: string; lineName: string; groupName: string; supplyCategoryName: string; partCode: string; partName: string; qty: number; unit: string; operatorName: string; shift: number; type: string }
export default function History() {
  const [from, setFrom] = useState(todayStr()); const [to, setTo] = useState(todayStr()); const [n, setN] = useState(300)
  const [shift, setShift] = useState(''); const [type, setType] = useState(''); const [q, setQ] = useState(''); const [showF, setShowF] = useState(false); const [open, setOpen] = useState('')
  const [txs, setTxs] = useState<Tx[]>([]); const [rev, setRev] = useState<Set<string>>(new Set()); const [err, setErr] = useState('')
  useEffect(() => {
    const a = new Date(`${from}T00:00:00`), b = new Date(`${to}T00:00:00`); b.setDate(b.getDate() + 1)
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return
    const u1 = onSnapshot(query(collection(db, 'supplyTransactions'), where('createdAt', '>=', a), where('createdAt', '<', b), orderBy('createdAt', 'desc'), limit(n)), s => setTxs(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Tx, 'id'>) }))), e => setErr(e.message))
    const u2 = onSnapshot(query(collection(db, 'transactionAdjustments'), where('txCreatedAt', '>=', a), where('txCreatedAt', '<', b), orderBy('txCreatedAt', 'desc'), limit(n)), s => setRev(new Set(s.docs.map(d => d.data().txId as string))), e => setErr(e.message))
    return () => { u1(); u2() }
  }, [from, to, n])
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = useMemo(() => txs.filter(t => (!shift || t.shift === Number(shift)) && (!type || t.type === type) && tokens.every(k => `${t.partCode} ${t.partName} ${t.modelName} ${t.operatorName} ${t.lineName} ${t.groupName} ${t.supplyCategoryName}`.toLowerCase().includes(k))), [txs, shift, type, q])
  const nF = [shift, type].filter(Boolean).length
  const doExport = () => exportXlsx(`riwayat-${from}_${to}`, shown.map(t => ({ Waktu: t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('id-ID') : '', Model: t.modelName, Kategori: t.productCategoryName, Line: t.lineName, Group: t.groupName, 'Supply Category': t.supplyCategoryName, 'Kode Part': t.partCode, 'Nama Part': t.partName, Qty: t.qty, Unit: t.unit, Operator: t.operatorName, Shift: t.shift, Tipe: t.type, Dikoreksi: rev.has(t.id) ? 'Ya' : '' })), 'Riwayat')
  const typePill = (t: Tx) => rev.has(t.id) ? <Pill>Dikoreksi</Pill> : t.type === 'OVER_SUPPLY' ? <StatusPill status="OVER_SUPPLY" /> : null
  return <div>
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <input aria-label="Dari" type="date" className="input !w-auto" value={from} onChange={e => setFrom(e.target.value)} /><span className="text-mute">–</span><input aria-label="Sampai" type="date" className="input !w-auto" value={to} onChange={e => setTo(e.target.value)} />
      <button className={`chip gap-1.5 ${nF ? 'chip-on' : ''}`} onClick={() => setShowF(!showF)}><SlidersHorizontal size={15} />Filter{nF > 0 && ` (${nF})`}</button>
      <button disabled={!shown.length} className="btn btn-secondary btn-sm ml-auto" onClick={doExport}><Download size={15} />Excel ({shown.length})</button></div>
    <div className="relative mb-3"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" /><input aria-label="Cari" className="input !pl-10" placeholder="Cari part, model, operator, line, group…" value={q} onChange={e => setQ(e.target.value)} /></div>
    {showF && <div className="surface p-3 mb-3 grid grid-cols-2 gap-2 animate-fade"><select className="input" value={shift} onChange={e => setShift(e.target.value)}><option value="">Semua shift</option><option value="1">Shift 1</option><option value="2">Shift 2</option><option value="3">Shift 3</option></select>
      <select className="input" value={type} onChange={e => setType(e.target.value)}><option value="">Semua tipe</option><option value="TAKE_ALL">Take all</option><option value="PARTIAL">Sebagian</option><option value="OVER_SUPPLY">Over supply</option></select></div>}
    {err && <ErrorNote>{err}</ErrorNote>}
    {shown.length === 0 ? <div className="surface"><Empty title="Tidak ada transaksi" hint="Ubah rentang tanggal atau filter." /></div> : <>
      <div className="hidden md:block surface overflow-hidden"><table className="tbl"><thead><tr><th>Waktu</th><th>Part</th><th>Model</th><th>Line / Group</th><th>Shift</th><th>Operator</th><th className="text-right">Qty</th><th></th></tr></thead>
        <tbody>{shown.map(t => <tr key={t.id} className={rev.has(t.id) ? 'opacity-50' : ''}><td className="whitespace-nowrap text-mute">{when(t.createdAt)}</td><td><p className={`font-semibold num ${rev.has(t.id) ? 'line-through' : ''}`}><Highlight text={t.partCode} tokens={tokens} /></p><p className="text-xs text-mute max-w-56 truncate"><Highlight text={t.partName} tokens={tokens} /></p></td>
          <td>{t.modelName}</td><td className="whitespace-nowrap">{t.lineName} · {t.groupName}</td><td className="num">{t.shift}</td><td>{t.operatorName}</td><td className="text-right font-bold num whitespace-nowrap">{t.qty} <span className="text-xs font-normal text-mute">{t.unit}</span></td><td>{typePill(t)}</td></tr>)}</tbody></table></div>
      <ul className="md:hidden surface divide-y divide-line overflow-hidden">{shown.map(t => { const o = open === t.id
        return <li key={t.id} className={rev.has(t.id) ? 'opacity-50' : ''}><button className="w-full text-left px-4 py-3 flex gap-3 items-center" aria-expanded={o} onClick={() => setOpen(o ? '' : t.id)}>
          <div className="flex-1 min-w-0"><p className={`font-semibold num ${rev.has(t.id) ? 'line-through' : ''}`}><Highlight text={t.partCode} tokens={tokens} /></p><p className="text-xs text-mute truncate">{t.modelName} · Shift {t.shift} · {t.operatorName}</p></div>
          <div className="text-right"><p className="font-bold num">{t.qty} <span className="text-xs font-normal text-mute">{t.unit}</span></p>{typePill(t)}</div><ChevronDown size={16} className={`text-mute transition-transform ${o ? 'rotate-180' : ''}`} /></button>
          {o && <dl className="px-4 pb-3 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 animate-fade">{[['Nama part', t.partName], ['Waktu', when(t.createdAt)], ['Line / Group', `${t.lineName} · ${t.groupName}`], ['Supply category', t.supplyCategoryName || '-'], ['Kategori', t.productCategoryName]].map(([k, v]) => <div key={k} className="contents"><dt className="text-mute">{k}</dt><dd>{v}</dd></div>)}</dl>}</li> })}</ul></>}
    {txs.length >= n && <button className="btn btn-secondary w-full mt-3" onClick={() => setN(n + 300)}>Muat lebih banyak</button>}</div>
}
