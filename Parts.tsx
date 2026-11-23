import { useMemo, useState } from 'react'
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { partId } from '../lib/slug'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import { Empty, ErrorNote, Highlight, Loading, Pill, Sheet } from '../ui'
interface Part { code: string; name: string; unit: string; supplyCategoryId: string; description?: string; active: boolean }
interface Named { name: string }
interface Header { modelId: string; version: number; active: boolean }
interface Use { model: string; qty: number }
const blank = { code: '', name: '', unit: 'PCS', supplyCategoryId: '', description: '' }
export default function Parts() {
  const { user, role } = useAuth(); const admin = role === 'ADMIN'
  const parts = useCollection<Part>('parts'); const cats = useCollection<Named>('supplyCategories'); const models = useCollection<Named>('models'); const boms = useCollection<Header>('bomHeaders')
  const [q, setQ] = useState(''); const [f, setF] = useState(blank); const [msg, setMsg] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [formOpen, setFormOpen] = useState(false)
  const [open, setOpen] = useState(''); const [uses, setUses] = useState<Record<string, Use[] | 'loading'>>({})
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = useMemo(() => parts.items.filter(p => { const hay = `${p.code} ${p.name} ${p.description ?? ''}`.toLowerCase(); return tokens.every(t => hay.includes(t)) }).sort((a, b) => a.code.localeCompare(b.code)), [parts.items, q])
  const shown = matches.slice(0, 60)
  const catName = (id: string) => cats.items.find(c => c.id === id)?.name ?? 'Tidak dicatat di aplikasi'
  const toggle = async (p: Part & { id: string }) => {
    if (open === p.id) return setOpen(''); setOpen(p.id); if (uses[p.id]) return
    setUses(u => ({ ...u, [p.id]: 'loading' }))
    try {
      const active = new Set(boms.items.filter(h => h.active).map(h => `${h.modelId}_v${h.version}`))
      const s = await getDocs(query(collection(db, 'bomDetails'), where('partId', '==', p.id)))
      const list = s.docs.map(d => d.data()).filter(d => active.has(d.bomId)).map(d => ({ model: models.items.find(m => m.id === d.modelId)?.name ?? d.modelId, qty: d.qtyPerUnit as number })).sort((a, b) => a.model.localeCompare(b.model))
      setUses(u => ({ ...u, [p.id]: list }))
    } catch { setUses(u => ({ ...u, [p.id]: [] })) }
  }
  const save = async () => {
    setMsg('')
    try {
      if (!f.code.trim() || !f.name.trim()) throw new Error('Kode dan nama wajib diisi')
      const id = partId(f.code); const old = parts.items.find(p => p.id === id)
      if (old && editing !== id) throw new Error('Kode part sudah ada')
      const data = { code: f.code.trim().toUpperCase(), name: f.name.trim(), unit: f.unit.trim(), supplyCategoryId: f.supplyCategoryId, description: f.description.trim(), active: old?.active ?? true, updatedAt: serverTimestamp() }
      await setDoc(doc(db, 'parts', id), data, { merge: true }); await audit(user!, old ? 'UPDATE' : 'CREATE', 'parts', id, old ?? null, data)
      setF(blank); setEditing(null); setFormOpen(false)
    } catch (e) { setMsg((e as Error).message) }
  }
  const setActive = async (p: Part & { id: string }) => { await setDoc(doc(db, 'parts', p.id), { active: !p.active }, { merge: true }); await audit(user!, p.active ? 'DEACTIVATE' : 'ACTIVATE', 'parts', p.id, { active: p.active }, { active: !p.active }) }
  return <div>
    <div className="relative mb-2"><Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" /><input autoFocus aria-label="Cari part" className="input !min-h-14 !pl-12 !text-lg !rounded-xl shadow-sm" placeholder="Cari kode atau nama part" value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="flex items-center mb-4 px-1"><p className="flex-1 text-xs text-mute num">{parts.loading ? 'Memuat…' : tokens.length ? `${matches.length} hasil${matches.length > 60 ? ' (60 teratas)' : ''}` : `${parts.items.length} part terdaftar. Ketik untuk mencari.`}</p>
      {admin && <button className="btn btn-secondary btn-sm" onClick={() => { setF(blank); setEditing(null); setMsg(''); setFormOpen(true) }}><Plus size={15} />Tambah part</button>}</div>
    {parts.error && <ErrorNote>{parts.error}</ErrorNote>}
    {parts.loading ? <Loading /> : shown.length === 0 ? <div className="surface"><Empty title="Part tidak ditemukan" hint="Coba sebagian kode, kata kunci nama, atau ejaan lain." /></div> :
      <ul className="surface divide-y divide-line overflow-hidden">{shown.map(p => { const isOpen = open === p.id; const u = uses[p.id]
        return <li key={p.id}><button className="w-full text-left px-4 py-3.5 flex gap-3 items-start hover:bg-canvas/60 transition-colors" aria-expanded={isOpen} onClick={() => toggle(p)}>
          <div className={`flex-1 min-w-0 ${p.active ? '' : 'opacity-50'}`}><p className="font-bold num"><Highlight text={p.code} tokens={tokens} />{!p.active && <span className="ml-2"><Pill>Nonaktif</Pill></span>}</p><p className="text-sm text-ink2 mt-0.5"><Highlight text={p.name} tokens={tokens} /></p><p className="text-xs text-mute mt-0.5">{catName(p.supplyCategoryId)} · {p.unit}</p></div>
          <ChevronDown size={18} className={`text-mute mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>
          {isOpen && <div className="px-4 pb-4 animate-fade"><p className="text-xs font-medium text-mute mb-2">Dipakai di model (BOM aktif)</p>
            {u === 'loading' || !u ? <Loading label="Mencari model…" /> : u.length === 0 ? <p className="text-sm text-mute">Belum dipakai di BOM aktif mana pun.</p> :
              <div className="flex flex-wrap gap-1.5">{u.map(x => <span key={x.model} className="chip !min-h-8 text-xs">{x.model}<b className="ml-1.5 num">×{x.qty}</b></span>)}</div>}
            {admin && <div className="flex gap-1 mt-3"><button className="btn btn-secondary btn-sm" onClick={() => { setEditing(p.id); setF({ code: p.code, name: p.name, unit: p.unit, supplyCategoryId: p.supplyCategoryId, description: p.description ?? '' }); setMsg(''); setFormOpen(true) }}>Ubah</button><button className="btn btn-ghost btn-sm" onClick={() => setActive(p)}>{p.active ? 'Nonaktifkan' : 'Aktifkan'}</button></div>}</div>}</li> })}</ul>}
    <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Ubah part' : 'Tambah part'}><div className="grid gap-3 grid-cols-2">
      <div><label className="label">Kode part</label><input className="input" disabled={!!editing} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></div>
      <div><label className="label">Unit</label><input className="input" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></div>
      <div className="col-span-2"><label className="label">Nama part</label><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div className="col-span-2"><label className="label">Supply category</label><select className="input" value={f.supplyCategoryId} onChange={e => setF({ ...f, supplyCategoryId: e.target.value })}><option value="">Tidak dicatat (tanpa kategori)</option>{cats.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="col-span-2"><label className="label">Deskripsi (opsional)</label><input className="input" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
      {msg && <div className="col-span-2"><ErrorNote>{msg}</ErrorNote></div>}<button className="btn btn-primary btn-lg col-span-2" onClick={save}>{editing ? 'Simpan perubahan' : 'Tambah part'}</button></div></Sheet></div>
}
