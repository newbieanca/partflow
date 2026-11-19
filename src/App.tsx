import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import MasterData from './pages/MasterData'
import Parts from './pages/Parts'
import BomImport from './pages/BomImport'
import Production from './pages/Production'
import Supply from './pages/Supply'
import History from './pages/History'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Audit from './pages/Audit'
function Login() {
  const { login } = useAuth(); const [e, setE] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState('')
  return <div className="min-h-screen grid place-items-center bg-slate-100 p-4"><div className="w-full max-w-sm bg-white rounded-xl p-6 shadow space-y-3">
    <h1 className="text-2xl font-bold text-[#0b1f3a]">PARTFLOW</h1>
    <input className="w-full border rounded-lg p-3" placeholder="Email" value={e} onChange={x => setE(x.target.value)} />
    <input className="w-full border rounded-lg p-3" type="password" placeholder="Password" value={p} onChange={x => setP(x.target.value)} />
    {err && <p className="text-red-600 text-sm">{err}</p>}
    <button className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold" onClick={() => login(e, p).catch(() => setErr('Login gagal'))}>Masuk</button></div></div>
}
const link = ({ isActive }: { isActive: boolean }) => `px-3 py-2 rounded-lg ${isActive ? 'bg-white text-[#0b1f3a]' : 'text-white'}`
export default function App() {
  const { user, role, loading, logout } = useAuth()
  if (loading) return <p className="p-6">Memuat…</p>
  if (!user) return <Login />
  const admin = role === 'ADMIN'; const leaderUp = admin || role === 'LEADER'
  return <div className="min-h-screen bg-slate-100">
    <header className="bg-[#0b1f3a] p-3 flex flex-wrap items-center gap-2"><b className="text-white mr-2">PARTFLOW</b>
      <NavLink to="/" end className={link}>Beranda</NavLink>{leaderUp && <NavLink to="/laporan" className={link}>Laporan</NavLink>}<NavLink to="/produksi" className={link}>Produksi</NavLink><NavLink to="/supply" className={link}>Supply</NavLink><NavLink to="/riwayat" className={link}>Riwayat</NavLink><NavLink to="/part" className={link}>Part</NavLink>
      {admin && <><NavLink to="/master" className={link}>Master Data</NavLink><NavLink to="/audit" className={link}>Audit</NavLink><NavLink to="/bom" className={link}>Impor BOM</NavLink></>}
      <span className="ml-auto text-xs text-slate-300">{user.email} · {role}</span><button className="text-white underline text-sm" onClick={logout}>Keluar</button></header>
    <main className="p-4 max-w-4xl mx-auto"><Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/laporan" element={leaderUp ? <Reports /> : <Navigate to="/" />} />
      <Route path="/audit" element={admin ? <Audit /> : <Navigate to="/" />} />
      <Route path="/produksi" element={<Production />} />
      <Route path="/supply" element={<Supply />} />
      <Route path="/riwayat" element={<History />} />
      <Route path="/part" element={<Parts />} />
      <Route path="/master" element={admin ? <MasterData /> : <Navigate to="/" />} />
      <Route path="/bom" element={admin ? <BomImport /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" />} /></Routes></main></div>
}
