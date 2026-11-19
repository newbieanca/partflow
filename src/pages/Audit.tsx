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
  return <div className="space-y-4"><h2 className="text-lg font-bold">Audit Log</h2>
    <input className="w-full border rounded-lg p-3" placeholder="Cari aksi, entitas, pengguna, alasan…" value={q} onChange={e => setQ(e.target.value)} />{err && <p className="text-red-600">{err}</p>}
    <ul className="space-y-2">{shown.map(l => <li key={l.id} className="bg-white rounded-xl shadow p-3 text-sm"><div className="flex gap-2"><b className="flex-1">{l.action} · {l.entityType}</b><span className="text-slate-500">{when(l.createdAt)}</span></div>
      <p className="text-slate-600">{l.name} · {l.entityId}{l.reason && ` · Alasan: ${l.reason}`}</p>
      <details><summary className="cursor-pointer underline">Sebelum / sesudah</summary><pre className="text-xs overflow-x-auto bg-slate-50 p-2 rounded">{JSON.stringify({ before: l.before, after: l.after }, null, 1)}</pre></details></li>)}</ul>
    {logs.length >= n && <button className="w-full border rounded-lg p-3" onClick={() => setN(n + 200)}>Muat lebih banyak</button>}</div>
}
