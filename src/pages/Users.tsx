import { useState } from 'react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, firebaseConfig } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../lib/types'
interface U { name: string; email: string; role: Role; active?: boolean }
const ROLES: Role[] = ['OPERATOR', 'LEADER', 'ADMIN']
export default function Users() {
  const { user } = useAuth(); const { items, loading, error } = useCollection<U>('users')
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'OPERATOR' as Role }); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const sorted = [...items].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  const run = async (fn: () => Promise<unknown>) => { setMsg(''); try { await fn() } catch (e) { setMsg((e as Error).message) } }
  const create = async () => {
    setMsg('')
    if (!f.name.trim() || !f.email.includes('@') || f.password.length < 6) return setMsg('Isi nama, email yang valid, dan password minimal 6 karakter.')
    setBusy(true)
    try {
      // A second Firebase app instance keeps the admin signed in while the new account is created.
      const app = getApps().find(a => a.name === 'admin-create') ? getApp('admin-create') : initializeApp(firebaseConfig, 'admin-create'); const a2 = getAuth(app)
      const cred = await createUserWithEmailAndPassword(a2, f.email.trim(), f.password)
      try {
        await updateProfile(cred.user, { displayName: f.name.trim() })
        await setDoc(doc(db, 'users', cred.user.uid), { name: f.name.trim(), email: f.email.trim(), role: f.role, active: true, createdAt: serverTimestamp(), createdBy: user!.uid })
        await audit(user!, 'USER_CREATE', 'users', cred.user.uid, null, { email: f.email.trim(), role: f.role })
      } finally { await signOut(a2) }
      setMsg(`Akun ${f.email.trim()} dibuat (${f.role}). Berikan email dan password ke pengguna.`); setF({ name: '', email: '', password: '', role: 'OPERATOR' })
    } catch (e) { setMsg((e as Error).message.includes('email-already-in-use') ? 'Email sudah terdaftar.' : (e as Error).message) } finally { setBusy(false) }
  }
  const setRole = (u: U & { id: string }, role: Role) => { if (confirm(`Ubah role ${u.name} dari ${u.role} menjadi ${role}?`)) run(async () => { await updateDoc(doc(db, 'users', u.id), { role }); await audit(user!, 'USER_ROLE', 'users', u.id, { role: u.role }, { role }) }) }
  const toggle = (u: U & { id: string }) => { const to = u.active === false; if (confirm(`${to ? 'Aktifkan' : 'Nonaktifkan'} akun ${u.name}?`)) run(async () => { await updateDoc(doc(db, 'users', u.id), { active: to }); await audit(user!, to ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', 'users', u.id, { active: !to }, { active: to }) }) }
  const rename = (u: U & { id: string }) => { const n = prompt('Nama baru:', u.name)?.trim(); if (n && n !== u.name) run(async () => { await updateDoc(doc(db, 'users', u.id), { name: n }); await audit(user!, 'USER_RENAME', 'users', u.id, { name: u.name }, { name: n }) }) }
  const reset = (u: U) => run(async () => { await sendPasswordResetEmail(auth, u.email); setMsg(`Email reset password dikirim ke ${u.email} (hanya sampai jika email asli).`) })
  const inp = 'border rounded-lg p-3 w-full'
  return <div className="space-y-4"><h2 className="text-lg font-bold">Pengguna</h2>
    <div className="bg-white rounded-xl shadow p-4 grid gap-2 sm:grid-cols-2"><b className="sm:col-span-2">Tambah akun</b>
      <input className={inp} placeholder="Nama lengkap" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input className={inp} type="email" placeholder="Email (boleh nama@partflow.local)" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
      <input className={inp} type="text" placeholder="Password awal (min. 6 karakter)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
      <select className={inp} value={f.role} onChange={e => setF({ ...f, role: e.target.value as Role })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
      <button disabled={busy} className="sm:col-span-2 bg-blue-600 disabled:opacity-40 text-white rounded-lg p-3 font-semibold" onClick={create}>{busy ? 'Membuat…' : 'Buat akun'}</button></div>
    {msg && <p className="font-medium bg-white rounded-lg p-3 shadow">{msg}</p>}{error && <p className="text-red-600">{error}</p>}{loading && <p>Memuat…</p>}
    <ul className="space-y-2">{sorted.map(u => { const me = u.id === user?.uid; const off = u.active === false
      return <li key={u.id} className={`bg-white rounded-xl shadow p-3 space-y-2 ${off ? 'opacity-60' : ''}`}><div><b>{u.name}</b>{me && <em className="text-xs text-slate-500"> (Anda)</em>}{off && <span className="text-xs text-red-600"> · NONAKTIF</span>}<div className="text-sm text-slate-500">{u.email}</div></div>
        <div className="flex gap-2 flex-wrap items-center"><select disabled={me} className="border rounded-lg p-2 text-sm" value={u.role} onChange={e => setRole(u, e.target.value as Role)}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
          <button className="underline text-sm" onClick={() => rename(u)}>Ubah nama</button>{!me && <button className="underline text-sm" onClick={() => toggle(u)}>{off ? 'Aktifkan' : 'Nonaktifkan'}</button>}<button className="underline text-sm" onClick={() => reset(u)}>Reset password</button></div></li> })}</ul></div>
}
