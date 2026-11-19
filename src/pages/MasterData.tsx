import { useState } from 'react'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { slug } from '../lib/slug'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
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
  const { user } = useAuth()
  const { items, loading, error } = useCollection<Item>(tab.key)
  const cats = useCollection<Item>('productCategories')
  const [name, setName] = useState(''); const [cat, setCat] = useState(''); const [msg, setMsg] = useState('')
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const run = async (f: () => Promise<unknown>) => { setMsg(''); try { await f() } catch (e) { setMsg((e as Error).message) } }
  const add = (n: string, c = '') => run(async () => {
    const id = slug(n); if (!id) throw new Error('Nama tidak valid')
    if (items.some(i => i.id === id)) throw new Error(`"${n}" sudah ada`)
    const data: Record<string, unknown> = { name: n.trim(), active: true, createdAt: serverTimestamp() }
    if (tab.key === 'models') data.productCategoryId = c
    await setDoc(doc(db, tab.key, id), data); await audit(user!, 'CREATE', tab.key, id, null, data)
  })
  const toggle = (i: Item & { id: string }) => run(async () => { await updateDoc(doc(db, tab.key, i.id), { active: !i.active }); await audit(user!, i.active ? 'DEACTIVATE' : 'ACTIVATE', tab.key, i.id, { active: i.active }, { active: !i.active }) })
  const rename = (i: Item & { id: string }) => { const n = prompt('Nama baru:', i.name)?.trim(); if (n && n !== i.name) run(async () => { await updateDoc(doc(db, tab.key, i.id), { name: n }); await audit(user!, 'UPDATE', tab.key, i.id, { name: i.name }, { name: n }) }) }
  if (loading) return <p>Memuat…</p>
  return <div className="space-y-3">
    {error && <p className="text-red-600">{error}</p>}{msg && <p className="text-red-600">{msg}</p>}
    {!items.length && tab.seed.length > 0 && <button className="bg-blue-600 text-white rounded-lg px-4 py-3" onClick={() => run(async () => { for (const s of tab.seed) await add(s) })}>Isi nilai awal ({tab.seed.join(', ')})</button>}
    <div className="flex gap-2 flex-wrap">
      <input className="border rounded-lg p-3 flex-1 min-w-40" placeholder="Nama baru" value={name} onChange={e => setName(e.target.value)} />
      {tab.key === 'models' && <select className="border rounded-lg p-3" value={cat} onChange={e => setCat(e.target.value)}><option value="">Kategori produk…</option>{cats.items.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      <button className="bg-blue-600 text-white rounded-lg px-4 py-3" onClick={async () => { await add(name, cat); setName('') }}>Tambah</button>
    </div>
    <ul className="divide-y bg-white rounded-xl shadow">{sorted.map(i => <li key={i.id} className="p-3 flex items-center gap-3">
      <span className={`flex-1 ${i.active ? '' : 'line-through text-slate-400'}`}>{i.name}</span>
      {tab.key === 'models' && <select className="border rounded-lg p-1 text-sm" value={i.productCategoryId ?? ''} onChange={e => run(async () => { await updateDoc(doc(db, 'models', i.id), { productCategoryId: e.target.value }); await audit(user!, 'UPDATE', 'models', i.id, { productCategoryId: i.productCategoryId ?? '' }, { productCategoryId: e.target.value }) })}><option value="">Kategori…</option>{cats.items.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      {tab.key === 'models' && <select className="border rounded p-1 text-sm" value={i.productCategoryId ?? ''} onChange={e => run(async () => { await updateDoc(doc(db, 'models', i.id), { productCategoryId: e.target.value }); await audit(user!, 'UPDATE', 'models', i.id, { productCategoryId: i.productCategoryId ?? '' }, { productCategoryId: e.target.value }) })}><option value="">Kategori…</option>{cats.items.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      <button className="underline text-sm" onClick={() => rename(i)}>Ubah</button>
      <button className="underline text-sm" onClick={() => toggle(i)}>{i.active ? 'Nonaktifkan' : 'Aktifkan'}</button></li>)}</ul>
  </div>
}
export default function MasterData() {
  const [k, setK] = useState(TABS[0].key); const tab = TABS.find(t => t.key === k)!
  return <div className="space-y-4"><h2 className="text-lg font-bold">Master Data</h2>
    <div className="flex gap-2 flex-wrap">{TABS.map(t => <button key={t.key} onClick={() => setK(t.key)} className={`px-3 py-2 rounded-lg ${k === t.key ? 'bg-[#0b1f3a] text-white' : 'bg-white border'}`}>{t.label}</button>)}</div>
    <List key={k} tab={tab} /></div>
}
