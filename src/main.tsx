import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './auth/AuthContext'
function Login() {
  const { login } = useAuth(); const [e, setE] = React.useState(''); const [p, setP] = React.useState(''); const [err, setErr] = React.useState('')
  return <div className="min-h-screen grid place-items-center bg-slate-100 p-4"><div className="w-full max-w-sm bg-white rounded-xl p-6 shadow space-y-3">
    <h1 className="text-2xl font-bold text-[#0b1f3a]">PARTFLOW</h1>
    <input className="w-full border rounded-lg p-3" placeholder="Email" value={e} onChange={x => setE(x.target.value)} />
    <input className="w-full border rounded-lg p-3" type="password" placeholder="Password" value={p} onChange={x => setP(x.target.value)} />
    {err && <p className="text-red-600 text-sm">{err}</p>}
    <button className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold" onClick={() => login(e, p).catch(() => setErr('Login failed'))}>Sign in</button></div></div>
}
function Shell() {
  const { user, role, loading, logout } = useAuth()
  if (loading) return <p className="p-6">Loading…</p>
  if (!user) return <Login />
  return <div className="p-6 space-y-2"><h1 className="text-xl font-bold text-[#0b1f3a]">PARTFLOW</h1><p>{user.email} · {role}</p><button className="underline" onClick={logout}>Sign out</button></div>
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><Shell /></AuthProvider></BrowserRouter>)
