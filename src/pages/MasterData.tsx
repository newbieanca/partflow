import { useState } from 'react'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { Plus, Search } from 'lucide-react'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { slug } from '../lib/slug'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import { Empty, ErrorNote, Loading, Pill, Toast, useDialog } from '../ui'
interface Item { name: string; active: boolean; productCategoryId?: string }
const TABS = [
  { key: 'productCategories', label: 'Kategori Produk', seed: ['TWINTUB', 'FULL AUTO', 'FRONT LOADING'] },
  { key: 'supplyCategories', label: 'Supply Category', seed: ['Supply Base', 'Supply Basket', 'Supply Top Cover', 'Supply Packing'] },
  { key: 'productionLines', label: 'Line', seed: ['Line A', 'Line B'] },
  { key: 'operatorGroups', label: 'Group', seed: ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F'] },
  { key: 'shifts', label: 'Shift', seed: ['Shift 1', 'Shift 2', 'Shift 3'] },
  { key: 'models', label: 'Model', seed: [] as string[] },
]
function List({ tab }: { tab: typeof TABS[number] }) {
  const { user } = useAuth(); const { prompt } = useDialog()
  const { items, loading, error } = useCollection<Item>(tab.key)
  const cats = useCollection<Item>('productCategories')
  const [name, setName] = useState(''); const [cat, setCat] = useState(''); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(''); const [q, setQ] = useState('')
  const isModel = tab.key === 'models'
  const sorted = [...items].filter(i => i.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const run = async (f: () => Promise<unknown>) => { setMsg(''); try { await f() } catch (e) { setMsg((e as Error).message) } }
  const add = (n: string, c = '') => run(async () => {
    const id = slug(n); if (!id) throw new Error('Nama tidak valid')
    if (items.some(i => i.id === id)) throw new Error(`"${n}" sudah ada`)
    const data: Record<string, unknown> = { name: n.trim(), active: true, createdAt: serverTimestamp() }
    if (isModel) data.productCategoryId = c
    await setDoc(doc(db, tab.key, id), data); await audit(user!, 'CREATE', tab.key, id, null, data); setOk(`"${n.trim()}" ditambahkan`)
  })
  const toggle = (i: Item & { id: string }) => run(async () => { await updateDoc(doc(db, tab.key, i.id), { active: !i.active }); await audit(user!, i.active ? 'DEACTIVATE' : 'ACTIVATE', tab.key, i.id, { active: i.active }, { active: !i.active }) })
  const rename = async (i: Item & { id: string }) => { const n = await prompt({ title: 'Ubah nama', defaultValue: i.name, confirmLabel: 'Simpan' }); if (n && n !== i.name) run(async () => { await updateDoc(doc(db, tab.key, i.id), { name: n }); await audit(user!, 'UPDATE', tab.key, i.id, { name: i.name }, { name: n }) }) }
  const setCategory = (i: Item & { id: string }, c: string) => run(async () => { await updateDoc(doc(db, 'models', i.id), { productCategoryId: c }); await audit(user!, 'UPDATE', 'models', i.id, { productCategoryId: i.productCategoryId ?? '' }, { productCategoryId: c }) })
  if (loading) return <Loading />
  return <div>
    <div className="surface p-3 mb-3 flex gap-2 flex-wrap items-center">
      <input aria-label="Nama baru" className="input flex-1 min-w-40" placeholder={`Tambah ${tab.label.toLowerCase()} baru`} value={name} onChange={e => setName(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter' && name.trim()) { await add(name, cat); setName('') } }} />
      {isModel && <select aria-label="Kategori produk" className="input !w-auto" value={cat} onChange={e => setCat(e.target.value)}><option value="">Kategori…</option>{cats.items.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      <button disabled={!name.trim()} className="btn btn-primary" onClick={async () => { await add(name, cat); setName('') }}><Plus size={18} />Tambah</button></div>
    {(error || msg) && <ErrorNote>{error || msg}</ErrorNote>}
    {items.length > 8 && <div className="relative mb-3"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" /><input aria-label="Cari" className="input !pl-10" placeholder="Cari…" value={q} onChange={e => setQ(e.target.value)} /></div>}
    {items.length === 0 ? <div className="surface"><Empty title="Belum ada data" hint={tab.seed.length ? 'Isi dengan nilai awal sesuai spesifikasi, atau tambah manual.' : 'Model dibuat otomatis saat BOM diunggah.'} />{tab.seed.length > 0 && <div className="pb-6 text-center"><button className="btn btn-primary" onClick={() => run(async () => { for (const s of tab.seed) await add(s) })}>Isi nilai awal ({tab.seed.length})</button></div>}</div> :
      <div className="surface overflow-x-auto"><table className="tbl"><thead><tr><th>Nama</th>{isModel && <th>Kategori produk</th>}<th>Status</th><th></th></tr></thead>
        <tbody>{sorted.map(i => <tr key={i.id}><td className={`font-medium ${i.active ? '' : 'text-mute line-through'}`}>{i.name}</td>
          {isModel && <td><select aria-label={`Kategori ${i.name}`} className="input !min-h-9 !w-auto !text-sm" value={i.productCategoryId ?? ''} onChange={e => setCategory(i, e.target.value)}><option value="">Belum diatur</option>{cats.items.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>}
          <td><Pill tone={i.active ? 'ok' : 'mute'}>{i.active ? 'Aktif' : 'Nonaktif'}</Pill></td>
          <td className="text-right whitespace-nowrap"><button className="btn btn-ghost btn-sm" onClick={() => rename(i)}>Ubah</button><button className="btn btn-ghost btn-sm" onClick={() => toggle(i)}>{i.active ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>)}</tbody></table></div>}
    <Toast msg={ok} onClose={() => setOk('')} /></div>
}
export default function MasterData() {
  const [k, setK] = useState(TABS[0].key); const tab = TABS.find(t => t.key === k)!
  return <div>
    <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-line mb-4">{TABS.map(t => <button key={t.key} onClick={() => setK(t.key)} className={`px-3 min-h-11 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${k === t.key ? 'border-sharp text-ink font-semibold' : 'border-transparent text-mute'}`}>{t.label}</button>)}</div>
    <List key={k} tab={tab} /></div>
}
