import { Search } from 'lucide-react'
import { Empty, ErrorNote, Pill } from '../ui'
import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { when, type Ts } from '../lib/format'
interface Log { id: string; createdAt: Ts; name: string; action: string; entityType: string; entityId: string; reason: string | null; before: unknown; after: unknown }
export default function Audit() {
  const [logs, setLogs] = useState<Log[]>([]); const [n, setN] = useState(200); const [q, setQ] = useState(''); const [err, setErr] = useState('')
  useEffect(() => onSnapshot(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(n)), s => setLogs(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Log, 'id'>) }))), e => setErr(e.message)), [n])
  const t = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = logs.filter(l => t.every(k => `${l.action} ${l.entityType} ${l.entityId} ${l.name} ${l.reason ?? ''}`.toLowerCase().includes(k)))
  return <div>
    <div className="relative mb-3"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" /><input aria-label="Cari" className="input !pl-10" placeholder="Cari aksi, entitas, pengguna, alasan…" value={q} onChange={e => setQ(e.target.value)} /></div>
    {err && <ErrorNote>{err}</ErrorNote>}
    {shown.length === 0 ? <div className="surface"><Empty title="Tidak ada catatan" /></div> : <ul className="surface divide-y divide-line overflow-hidden">{shown.map(l => <li key={l.id} className="px-4 py-3">
      <div className="flex items-center gap-2"><Pill tone={/REVERSAL|DEACTIVATE|CANCEL/.test(l.action) ? 'bad' : 'info'}>{l.action}</Pill><span className="text-sm font-medium flex-1 truncate">{l.entityType}</span><span className="text-xs text-mute whitespace-nowrap">{when(l.createdAt)}</span></div>
      <p className="text-sm text-ink2 mt-1">{l.name} <span className="text-mute">· {l.entityId}</span></p>{l.reason && <p className="text-sm mt-0.5">Alasan: {l.reason}</p>}
      <details className="mt-1"><summary className="cursor-pointer text-xs text-mute font-medium">Sebelum / sesudah</summary><pre className="text-xs overflow-x-auto bg-canvas p-2 rounded-lg mt-1">{JSON.stringify({ before: l.before, after: l.after }, null, 1)}</pre></details></li>)}</ul>}
    {logs.length >= n && <button className="btn btn-secondary w-full mt-3" onClick={() => setN(n + 200)}>Muat lebih banyak</button>}</div>
}
