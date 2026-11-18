import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { partId } from '../lib/slug'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
interface Part { code: string; name: string; unit: string; supplyCategoryId: string; description?: string; active: boolean }
interface Named { name: string }
const empty = { code: '', name: '', unit: 'PCS', supplyCategoryId: '', description: '' }
export default function Parts() {
  const { user, role } = useAuth(); const admin = role === 'ADMIN'
  const parts = useCollection<Part>('parts'); const cats = useCollection<Named>('supplyCategories')
  const [q, setQ] = useState(''); const [f, setF] = useState(empty); const [msg, setMsg] = useState(''); const [editing, setEditing] = useState<string | null>(null)
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = parts.items.filter(p => { const hay = `${p.code} ${p.name} ${p.description ?? ''}`.toLowerCase(); return tokens.every(t => hay.includes(t)) })
    .sort((a, b) => a.code.localeCompare(b.code)).slice(0, 200)
  const save = async () => {
    setMsg('')
    try {
      if (!f.code.trim() || !f.name.trim() || !f.supplyCategoryId) throw new Error('Kode, nama, dan supply category wajib diisi')
      const id = partId(f.code); const old = parts.items.find(p => p.id === id)
      if (old && editing !== id) throw new Error('Kode part sudah ada')
      const data = { code: f.code.trim().toUpperCase(), name: f.name.trim(), unit: f.unit.trim(), supplyCategoryId: f.supplyCategoryId, description: f.description.trim(), active: old?.active ?? true, updatedAt: serverTimestamp() }
      await setDoc(doc(db, 'parts', id), data, { merge: true }); await audit(user!, old ? 'UPDATE' : 'CREATE', 'parts', id, old ?? null, data)
      setF(empty); setEditing(null)
    } catch (e) { setMsg((e as Error).message) }
  }
  const toggle = async (p: Part & { id: string }) => { await setDoc(doc(db, 'parts', p.id), { active: !p.active }, { merge: true }); await audit(user!, p.active ? 'DEACTIVATE' : 'ACTIVATE', 'parts', p.id, { active: p.active }, { active: !p.active }) }
  return <div className="space-y-4"><h2 className="text-lg font-bold">Part</h2>
    <input className="w-full border rounded-lg p-3" placeholder="Cari kode atau nama part…" value={q} onChange={e => setQ(e.target.value)} />
    {admin && <div className="bg-white rounded-xl shadow p-3 grid gap-2 sm:grid-cols-2">
      <input className="border rounded-lg p-2" placeholder="Kode part" value={f.code} disabled={!!editing} onChange={e => setF({ ...f, code: e.target.value })} />
      <input className="border rounded-lg p-2" placeholder="Nama part" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input className="border rounded-lg p-2" placeholder="Unit" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} />
      <select className="border rounded-lg p-2" value={f.supplyCategoryId} onChange={e => setF({ ...f, supplyCategoryId: e.target.value })}><option value="">Supply category…</option>{cats.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input className="border rounded-lg p-2 sm:col-span-2" placeholder="Deskripsi (opsional)" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      {msg && <p className="text-red-600 sm:col-span-2">{msg}</p>}
      <button className="bg-blue-600 text-white rounded-lg p-3 sm:col-span-2" onClick={save}>{editing ? 'Simpan perubahan' : 'Tambah part'}</button></div>}
    <p className="text-sm text-slate-500">{parts.items.length} part total · menampilkan {shown.length}</p>
    <ul className="divide-y bg-white rounded-xl shadow">{shown.map(p => <li key={p.id} className="p-3 flex items-center gap-3">
      <div className={`flex-1 ${p.active ? '' : 'text-slate-400 line-through'}`}><b>{p.code}</b> · {p.name}<div className="text-xs text-slate-500">{p.unit} · {cats.items.find(c => c.id === p.supplyCategoryId)?.name ?? '-'}</div></div>
      {admin && <><button className="underline text-sm" onClick={() => { setEditing(p.id); setF({ code: p.code, name: p.name, unit: p.unit, supplyCategoryId: p.supplyCategoryId, description: p.description ?? '' }) }}>Ubah</button>
        <button className="underline text-sm" onClick={() => toggle(p)}>{p.active ? 'Nonaktifkan' : 'Aktifkan'}</button></>}</li>)}</ul></div>
}
