import { useState, type ReactElement } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { canAccess, type Section } from './lib/access'
import { MENU } from './menu'
import Dashboard from './pages/Dashboard'
import Production from './pages/Production'
import Supply from './pages/Supply'
import History from './pages/History'
import Parts from './pages/Parts'
import Reports from './pages/Reports'
import MasterData from './pages/MasterData'
import BomImport from './pages/BomImport'
import Users from './pages/Users'
import Audit from './pages/Audit'
import Profile from './pages/Profile'
const PAGES: Record<Section, ReactElement> = { dashboard: <Dashboard />, produksi: <Production />, supply: <Supply />, riwayat: <History />, part: <Parts />, laporan: <Reports />, master: <MasterData />, bom: <BomImport />, pengguna: <Users />, audit: <Audit />, profil: <Profile /> }
function Login() {
  const { login, blocked } = useAuth(); const [e, setE] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const go = async () => { setErr(''); setBusy(true); try { await login(e.trim(), p) } catch { setErr('Email atau password salah.') } finally { setBusy(false) } }
  return <div className="min-h-screen grid place-items-center bg-slate-100 p-4"><div className="w-full max-w-sm bg-white rounded-xl p-6 shadow space-y-3">
    <h1 className="text-2xl font-bold text-[#0b1f3a]">PARTFLOW</h1><p className="text-sm text-slate-500">Part Supply Management</p>
    <input className="w-full border rounded-lg p-3" type="email" placeholder="Email" value={e} onChange={x => setE(x.target.value)} />
    <input className="w-full border rounded-lg p-3" type="password" placeholder="Password" value={p} onChange={x => setP(x.target.value)} onKeyDown={x => x.key === 'Enter' && go()} />
    {(err || blocked) && <p className="text-red-600 text-sm">{err || blocked}</p>}
    <button disabled={busy} className="w-full bg-blue-600 disabled:opacity-40 text-white rounded-lg p-3 font-semibold" onClick={go}>{busy ? 'Masuk…' : 'Masuk'}</button></div></div>
}
export default function App() {
  const { user, role, loading } = useAuth()
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Memuat…</div>
  if (!user) return <Login />
  const items = MENU.filter(m => canAccess(role, m.section)); const bottom = items.filter(m => m.bottom)
  const side = ({ isActive }: { isActive: boolean }) => `flex items-center gap-2 px-3 py-3 rounded-lg ${isActive ? 'bg-white text-[#0b1f3a] font-semibold' : 'text-slate-200 hover:bg-white/10'}`
  const tab = ({ isActive }: { isActive: boolean }) => `flex flex-col items-center justify-center min-h-16 text-xs ${isActive ? 'text-blue-700 font-bold' : 'text-slate-500'}`
  return <div className="min-h-screen bg-slate-100 md:flex">
    <aside className="hidden md:flex md:w-56 md:flex-col bg-[#0b1f3a] p-3 gap-1 sticky top-0 h-screen overflow-y-auto"><b className="text-white text-lg px-3 py-2">PARTFLOW</b>{items.map(m => <NavLink key={m.to} to={m.to} end={m.to === '/'} className={side}><span>{m.icon}</span>{m.label}</NavLink>)}</aside>
    <div className="flex-1 min-w-0">
      <header className="md:hidden bg-[#0b1f3a] text-white px-4 pb-3 flex items-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}><b>PARTFLOW</b><span className="ml-auto text-xs text-slate-300">{role}</span></header>
      <main className="p-4 max-w-4xl mx-auto pb-28 md:pb-8"><Routes>
        {MENU.map(m => <Route key={m.to} path={m.to} element={canAccess(role, m.section) ? PAGES[m.section] : <Navigate to="/" />} />)}
        <Route path="*" element={<Navigate to="/" />} /></Routes></main></div>
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t shadow-lg grid grid-cols-5 z-10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>{bottom.map(m => <NavLink key={m.to} to={m.to} end={m.to === '/'} className={tab}><span className="text-xl">{m.icon}</span>{m.label}</NavLink>)}</nav></div>
}
