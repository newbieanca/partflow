import { useState } from 'react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, firebaseConfig } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { audit } from '../lib/audit'
import { useAuth } from '../auth/AuthContext'
import { ErrorNote, Pill, Loading, Sheet, Toast, useDialog } from '../ui'
import { Plus } from 'lucide-react'
import type { Role } from '../lib/types'
interface U { name: string; email: string; role: Role; active?: boolean }
const ROLES: Role[] = ['OPERATOR', 'LEADER', 'ADMIN']
export default function Users() {
  const { user } = useAuth(); const { confirm, prompt } = useDialog(); const [formOpen, setFormOpen] = useState(false); const { items, loading, error } = useCollection<U>('users')
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
      setMsg(`Akun ${f.email.trim()} dibuat (${f.role}). Berikan email dan password ke pengguna.`); setFormOpen(false); setF({ name: '', email: '', password: '', role: 'OPERATOR' })
    } catch (e) { setMsg((e as Error).message.includes('email-already-in-use') ? 'Email sudah terdaftar.' : (e as Error).message) } finally { setBusy(false) }
  }
  const setRole = async (u: U & { id: string }, role: Role) => { if (await confirm({ title: 'Ubah role', message: `Ubah role ${u.name} dari ${u.role} menjadi ${role}?`, confirmLabel: 'Ubah' })) run(async () => { await updateDoc(doc(db, 'users', u.id), { role }); await audit(user!, 'USER_ROLE', 'users', u.id, { role: u.role }, { role }) }) }
  const toggle = async (u: U & { id: string }) => { const to = u.active === false; if (await confirm({ title: to ? 'Aktifkan akun' : 'Nonaktifkan akun', message: `${to ? 'Aktifkan' : 'Nonaktifkan'} akun ${u.name}?${to ? '' : ' Pengguna ini tidak bisa mengakses data lagi.'}`, confirmLabel: to ? 'Aktifkan' : 'Nonaktifkan', danger: !to })) run(async () => { await updateDoc(doc(db, 'users', u.id), { active: to }); await audit(user!, to ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', 'users', u.id, { active: !to }, { active: to }) }) }
  const rename = async (u: U & { id: string }) => { const n = await prompt({ title: 'Ubah nama', defaultValue: u.name, confirmLabel: 'Simpan' }); if (n && n !== u.name) run(async () => { await updateDoc(doc(db, 'users', u.id), { name: n }); await audit(user!, 'USER_RENAME', 'users', u.id, { name: u.name }, { name: n }) }) }
  const reset = (u: U) => run(async () => { await sendPasswordResetEmail(auth, u.email); setMsg(`Email reset password dikirim ke ${u.email} (hanya sampai jika email asli).`) })
  return <div>
    <div className="flex items-center mb-4"><p className="flex-1 text-sm text-mute num">{items.length} pengguna</p><button className="btn btn-primary" onClick={() => setFormOpen(true)}><Plus size={18} />Tambah akun</button></div>
    {error && <ErrorNote>{error}</ErrorNote>}{loading ? <Loading /> : <ul className="surface divide-y divide-line overflow-hidden">{sorted.map(u => { const me = u.id === user?.uid; const off = u.active === false
      return <li key={u.id} className="px-4 py-3.5"><div className={`flex items-center gap-3 ${off ? 'opacity-50' : ''}`}><span className="w-10 h-10 rounded-full bg-canvas text-ink2 grid place-items-center font-bold shrink-0">{(u.name ?? '?').charAt(0).toUpperCase()}</span>
        <div className="flex-1 min-w-0"><p className="font-semibold truncate">{u.name}{me && <span className="text-xs text-mute font-normal"> (Anda)</span>}</p><p className="text-xs text-mute truncate">{u.email}</p></div>{off && <Pill tone="bad">Nonaktif</Pill>}</div>
        <div className="flex gap-1 flex-wrap items-center mt-2"><select aria-label={`Role ${u.name}`} disabled={me} className="input !w-auto !min-h-9 !text-sm" value={u.role} onChange={e => setRole(u, e.target.value as Role)}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
          <button className="btn btn-ghost btn-sm" onClick={() => rename(u)}>Ubah nama</button>{!me && <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{off ? 'Aktifkan' : 'Nonaktifkan'}</button>}<button className="btn btn-ghost btn-sm" onClick={() => reset(u)}>Reset password</button></div></li> })}</ul>}
    <Sheet open={formOpen} onClose={() => setFormOpen(false)} title="Tambah akun"><div className="grid gap-3">
      <div><label className="label">Nama lengkap</label><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Email (boleh nama@partflow.local)</label><input className="input" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div><label className="label">Password awal (min. 6 karakter)</label><input className="input" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
      <div><label className="label">Role</label><select className="input" value={f.role} onChange={e => setF({ ...f, role: e.target.value as Role })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
      {msg && !msg.startsWith('Akun ') && !msg.startsWith('Email reset') && <ErrorNote>{msg}</ErrorNote>}<button disabled={busy} className="btn btn-primary btn-lg" onClick={async () => { await create(); }}>{busy ? 'Membuat…' : 'Buat akun'}</button></div></Sheet>
    <Toast msg={msg.startsWith('Akun ') || msg.startsWith('Email reset') ? msg : ''} onClose={() => setMsg('')} /></div>
}
