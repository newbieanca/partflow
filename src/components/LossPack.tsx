import { useMemo, useState } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../auth/AuthContext'
import { useLive } from '../lib/useLive'
import { correctQty } from '../lib/supply'
import { effectiveQty, lossPackDelta } from '../lib/takeLogic'
import { matchesCategory, useOpCat, useOpName } from '../lib/supplyProfile'
import { when, type Ts } from '../lib/format'
import { Empty, ErrorNote, Pill, Sheet } from '../ui'
interface Tx { partId: string; partCode: string; partName: string; qty: number; unit: string; shift: number; operatorName: string; createdAt: Ts; supplyCategoryId: string }
interface Adj { txId: string; type: string; qty: number; note?: string; userName?: string }
const ms = (t: Ts) => t?.toDate ? t.toDate().getTime() : Infinity
/** Pick a recorded transaction, enter the ACTUAL quantity and a loss-pack note. The original record is never edited (see correctQty). */
export function LossPackSheet({ open, onClose, productionId, title, partId }: { open: boolean; onClose: () => void; productionId: string; title: string; partId?: string }) {
  const { user, role } = useAuth(); const isSupply = role === 'OPERATOR'; const opName = useOpName().trim(); const opCat = useOpCat()
  const txs = useLive<Tx>('supplyTransactions', open ? productionId : ''); const adjs = useLive<Adj>('transactionAdjustments', open ? productionId : '')
  const [q, setQ] = useState(''); const [sel, setSel] = useState(''); const [actual, setActual] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState('')
  const rev = useMemo(() => new Set(adjs.filter(a => a.type === 'REVERSAL').map(a => a.txId)), [adjs]); const lp = useMemo(() => new Map(adjs.filter(a => a.type === 'LOSS_PACK').map(a => [a.txId, a])), [adjs])
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const list = useMemo(() => txs.filter(t => (!partId || t.partId === partId) && (!isSupply || matchesCategory(opCat, t.supplyCategoryId)) && tokens.every(k => `${t.partCode} ${t.partName}`.toLowerCase().includes(k)))
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt)).slice(0, 100), [txs, partId, isSupply, opCat, q])
  const cur = txs.find(t => t.id === sel)
  const close = () => { setSel(''); setActual(''); setNote(''); setErr(''); setDone(''); setQ(''); onClose() }
  let preview = ''; let valid = false
  if (cur && actual !== '') { try { const d = lossPackDelta(cur.qty, Number(actual)); preview = `Selisih ${d > 0 ? '+' : ''}${d} ${cur.unit} dari yang tercatat`; valid = true } catch (e) { preview = (e as Error).message } }
  const save = async () => {
    if (!cur) return; setErr('')
    if (isSupply && !opName) return setErr('Isi nama Anda di Beranda dulu.')
    setBusy(true)
    try { await correctQty(db, { txId: cur.id, newQty: Number(actual), note, user: { uid: user!.uid, name: isSupply && opName ? opName : (user!.displayName ?? user!.email ?? '') } }); setDone(`Tersimpan: ${cur.partCode} ${cur.qty} → ${Number(actual)} ${cur.unit}`); setSel(''); setActual(''); setNote('') }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return <Sheet open={open} onClose={close} title={cur ? 'Koreksi loss pack' : title}>
    {cur ? <div>
      <button className="btn btn-ghost btn-sm -ml-2 mb-2" onClick={() => { setSel(''); setErr('') }}><ChevronLeft size={18} />Kembali</button>
      <p className="font-bold num text-lg">{cur.partCode}</p><p className="text-sm text-ink2">{cur.partName}</p>
      <div className="grid grid-cols-2 rounded-xl bg-canvas text-center py-3 my-4"><div><p className="text-[11px] text-mute">Tercatat</p><p className="text-2xl font-bold num">{cur.qty}</p></div><div className="border-l border-line"><p className="text-[11px] text-mute">Shift · oleh</p><p className="text-sm font-semibold mt-1.5">{cur.shift} · {cur.operatorName}</p></div></div>
      <label className="label" htmlFor="lpq">Isi sebenarnya (qty aktual, {cur.unit})</label>
      <input id="lpq" autoFocus type="number" inputMode="decimal" min="0" step="any" className="input !text-3xl !font-bold !min-h-16 text-center num" value={actual} onChange={e => setActual(e.target.value)} />
      <p className={`text-sm mt-1 mb-4 min-h-5 ${valid ? 'text-amber-800 font-medium' : 'text-mute'}`}>{preview}</p>
      <label className="label" htmlFor="lpn">Catatan loss pack (wajib)</label>
      <input id="lpn" className="input mb-4" placeholder="Contoh: isi box kurang 3 pcs, ketahuan saat box habis" value={note} onChange={e => setNote(e.target.value)} />
      {err && <div className="mb-3"><ErrorNote>{err}</ErrorNote></div>}
      <button disabled={busy || !valid || note.trim().length < 3} className="btn btn-primary btn-lg w-full" onClick={save}>{busy ? 'Menyimpan…' : 'Simpan koreksi'}</button>
      <p className="text-xs text-mute mt-3">Catatan awal tidak dihapus. Koreksi tercatat dengan nama Anda dan bisa dilakukan sekali per transaksi.</p></div>
    : <div>
      {done && <p className="text-sm text-ok font-medium bg-green-50 rounded-lg p-3 mb-3">{done}</p>}
      {!partId && <div className="relative mb-3"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" /><input aria-label="Cari part" className="input !pl-10" placeholder="Cari kode atau nama part" value={q} onChange={e => setQ(e.target.value)} /></div>}
      <p className="text-xs text-mute mb-2">Pilih pengambilan yang isinya tidak sesuai, lalu isi jumlah sebenarnya.</p>
      {list.length === 0 ? <Empty title="Belum ada pengambilan" hint={isSupply ? 'Hanya pengambilan kategori Anda yang tampil.' : undefined} /> :
        <ul className="divide-y divide-line">{list.map(t => { const l = lp.get(t.id); const isRev = rev.has(t.id); const eff = effectiveQty(t.qty, l?.qty ?? 0)
          return <li key={t.id} className="py-3 flex gap-3 items-center"><div className="flex-1 min-w-0"><p className="font-semibold num">{t.partCode}<span className="text-mute font-normal"> · Shift {t.shift}</span></p><p className="text-xs text-mute truncate">{t.partName}</p><p className="text-xs text-mute">{t.operatorName} · {when(t.createdAt)}</p>
            {l && <p className="text-xs text-amber-800 mt-0.5">Loss pack {t.qty} → {eff}: {l.note}{l.userName && ` (${l.userName})`}</p>}</div>
            <div className="text-right shrink-0"><p className={`font-bold num ${isRev ? 'line-through text-mute' : ''}`}>{eff} <span className="text-xs font-normal text-mute">{t.unit}</span></p>
              {isRev ? <Pill>Dibatalkan</Pill> : l ? <Pill tone="warn">Loss pack</Pill> : <button className="btn btn-secondary btn-sm mt-1" onClick={() => { setSel(t.id); setErr(''); setDone('') }}>Edit</button>}</div></li> })}</ul>}</div>}
  </Sheet>
}
