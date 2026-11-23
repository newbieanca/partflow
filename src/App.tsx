import { useState, type ReactElement } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { canAccess, type Section } from './lib/access'
import { useShift } from './lib/shift'
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
import PartCategories from './pages/PartCategories'
import Backup from './pages/Backup'
import BackupBanner from './components/BackupBanner'
const PAGES: Record<Section, ReactElement> = { dashboard: <Dashboard />, produksi: <Production />, supply: <Supply />, riwayat: <History />, part: <Parts />, laporan: <Reports />, master: <MasterData />, bom: <BomImport />, pengguna: <Users />, audit: <Audit />, kategori: <PartCategories />, cadangan: <Backup />, profil: <Profile /> }
const Wordmark = ({ className = 'h-5' }: { className?: string }) => <img src="/brand/partflow-wordmark.webp" alt="PARTFLOW" className={`${className} w-auto`} />
function Login() {
  const { login, blocked } = useAuth(); const [e, setE] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const go = async () => { setErr(''); setBusy(true); try { await login(e.trim(), p) } catch { setErr('Email atau password salah.') } finally { setBusy(false) } }
  return <div className="min-h-screen md:grid md:grid-cols-[1.1fr_1fr]">
    <div className="hidden md:flex flex-col justify-between bg-white border-r border-line p-12 relative overflow-hidden">
      <div className="absolute -right-28 -bottom-28 w-[26rem] h-[26rem] rounded-full border-[44px] border-sharp/[0.04]" />
      <p className="relative text-xs text-mute">Production Department · WM Division</p>
      <img src="/brand/partflow-logo.webp" alt="PARTFLOW – Sharp, Precise, Efficient" className="relative w-full max-w-md mx-auto" />
      <div className="relative flex items-center gap-3"><img src="/brand/sharp-logo.webp" alt="SHARP" className="h-4 w-auto" /><span className="text-xs text-mute">PT Sharp Electronics Indonesia</span></div></div>
    <div className="min-h-screen md:min-h-0 grid place-items-center p-6"><div className="w-full max-w-sm">
      <img src="/brand/partflow-logo.webp" alt="PARTFLOW" className="md:hidden w-56 mx-auto mb-8" /><h1 className="text-2xl font-bold tracking-tight">Masuk</h1><p className="text-sm text-mute mt-1 mb-6">Gunakan akun dari Admin.</p>
      <div className="space-y-3"><div><label className="label" htmlFor="em">Email</label><input id="em" className="input" type="email" autoComplete="username" value={e} onChange={x => setE(x.target.value)} /></div>
        <div><label className="label" htmlFor="pw">Password</label><input id="pw" className="input" type="password" autoComplete="current-password" value={p} onChange={x => setP(x.target.value)} onKeyDown={x => x.key === 'Enter' && go()} /></div>
        {(err || blocked) && <p role="alert" className="text-sm text-bad">{err || blocked}</p>}
        <button disabled={busy} className="btn btn-primary btn-lg w-full" onClick={go}>{busy ? 'Masuk…' : 'Masuk'}</button></div>
      <div className="md:hidden mt-10 flex items-center justify-center gap-2"><img src="/brand/sharp-logo.webp" alt="SHARP" className="h-3.5 w-auto" /><span className="text-xs text-mute">PT Sharp Electronics Indonesia</span></div></div></div></div>
}
export default function App() {
  const { user, role, loading } = useAuth(); const loc = useLocation(); const shift = useShift()
  if (loading) return <div className="min-h-screen grid place-items-center text-mute text-sm">Memuat…</div>
  if (!user) return <Login />
  const items = MENU.filter(m => canAccess(role, m.section)); const bottom = items.filter(m => m.bottom)
  const cur = MENU.find(m => m.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(m.to)); const initial = (user.displayName ?? user.email ?? '?').trim().charAt(0).toUpperCase()
  const side = ({ isActive }: { isActive: boolean }) => `relative flex items-center gap-3 pl-4 pr-3 min-h-11 rounded-lg text-sm transition-colors ${isActive ? 'bg-sharp-soft text-ink font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-sharp' : 'text-ink2 hover:bg-black/5'}`
  const tab = ({ isActive }: { isActive: boolean }) => `relative flex flex-col items-center justify-center gap-0.5 min-h-16 text-[11px] transition-colors ${isActive ? 'text-sharp font-semibold' : 'text-mute'}`
  const shiftChip = <Link to="/supply" className={`pill ${shift ? 'bg-ink text-white' : 'bg-amber-50 text-amber-800'}`}>{shift ? `Shift ${shift}` : 'Pilih shift'}</Link>
  const avatar = <Link to="/profil" aria-label="Profil" className="w-9 h-9 rounded-full bg-ink text-white grid place-items-center text-sm font-bold">{initial}</Link>
  return <div className="min-h-screen md:flex">
    <aside className="hidden md:flex md:w-60 md:flex-col bg-white border-r border-line p-3 sticky top-0 h-screen"><div className="px-3 py-4 mb-2"><Wordmark className="h-6" /></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto">{items.filter(m => m.section !== 'profil').map(m => <NavLink key={m.to} to={m.to} end={m.to === '/'} className={side}><m.icon size={18} />{m.label}</NavLink>)}</nav>
      <Link to="/profil" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-black/5"><span className="w-9 h-9 rounded-full bg-ink text-white grid place-items-center text-sm font-bold">{initial}</span><span className="min-w-0"><span className="block text-sm font-semibold truncate">{user.displayName ?? user.email}</span><span className="block text-xs text-mute">{role}</span></span></Link></aside>
    <div className="flex-1 min-w-0">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-line px-4 md:px-8 flex items-center gap-3 min-h-14" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <img src="/brand/partflow-mark.webp" alt="PARTFLOW" className="md:hidden h-6 w-auto" /><h1 className="md:hidden flex-1 font-bold text-lg truncate">{cur?.label ?? 'PARTFLOW'}</h1>
        <p className="hidden md:block flex-1 text-sm text-mute"><span className="text-ink2 font-medium">PARTFLOW</span> / {cur?.label ?? ''}</p>
        <span className="hidden md:inline text-sm text-mute">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>{shiftChip}<span className="md:hidden">{avatar}</span></header>
      <main key={loc.pathname} className="animate-page px-4 md:px-8 py-5 md:py-8 max-w-5xl mx-auto pb-28 md:pb-10">{role === 'ADMIN' && <BackupBanner />}<Routes>
        {MENU.map(m => <Route key={m.to} path={m.to} element={canAccess(role, m.section) ? PAGES[m.section] : <Navigate to="/" />} />)}
        <Route path="*" element={<Navigate to="/" />} /></Routes></main></div>
    <nav aria-label="Navigasi utama" className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-line grid grid-cols-5 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {bottom.map(m => <NavLink key={m.to} to={m.to} end={m.to === '/'} className={tab}>{({ isActive }) => <>{isActive && <span className="absolute top-0 h-0.5 w-8 bg-sharp rounded-full" />}<m.icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />{m.label}</>}</NavLink>)}</nav></div>
}
